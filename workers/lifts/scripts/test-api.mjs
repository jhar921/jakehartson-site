/**
 * API checks against a local wrangler + D1 (miniflare).
 * Run: npm run check:api
 */
import { spawn } from "node:child_process";
import { once } from "node:events";
import { writeFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { canBypassAccess, requireAccess } from "../src/auth.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let passed = 0;
function assert(cond, msg) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  passed++;
}

assert(canBypassAccess({ LIFTS_DEV_BYPASS_ACCESS: "1" }) === true, "bypass on when flag set and aud unset");
assert(
  canBypassAccess({ LIFTS_DEV_BYPASS_ACCESS: "1", ACCESS_AUD: "aud" }) === false,
  "bypass off when ACCESS_AUD is set",
);
assert(
  canBypassAccess({ LIFTS_DEV_BYPASS_ACCESS: "1", ACCESS_TEAM_DOMAIN: "example.cloudflareaccess.com" }) === false,
  "bypass off when team domain is set",
);
assert(canBypassAccess({}) === false, "bypass off when flag is absent");
assert(canBypassAccess({ LIFTS_DEV_BYPASS_ACCESS: "0" }) === false, "bypass off when flag is not 1");

const denied = await requireAccess(new Request("http://lifts.test/api/state"), {
  ACCESS_AUD: "test-aud",
  ACCESS_TEAM_DOMAIN: "example.cloudflareaccess.com",
});
assert(denied.ok === false && denied.status === 401, "missing JWT is 401 when Access is configured");

const five = [5, 5, 5, 5, 5];
const v1 = {
  version: 1,
  sessions: [
    {
      id: "v1-sess",
      kind: "A",
      completedAt: "2026-11-01T16:00:00Z",
      lifts: [
        { lift: "squat", weight: 135, sets: five, notes: "" },
        { lift: "bench", weight: 95, sets: five, notes: "" },
        { lift: "row", weight: 95, sets: five, notes: "" },
      ],
    },
  ],
  progress: {
    squat: { nextWeight: 140, consecutiveFailures: 0 },
    bench: { nextWeight: 97.5, consecutiveFailures: 0 },
    row: { nextWeight: 97.5, consecutiveFailures: 0 },
    ohp: { nextWeight: null, consecutiveFailures: 0 },
    deadlift: { nextWeight: null, consecutiveFailures: 0 },
  },
  draft: null,
};

function waitForReady(child, port, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`wrangler on ${port} did not become ready`)), timeoutMs);
    let buf = "";
    const onData = (chunk) => {
      buf += chunk.toString();
      if (/Ready on|127\.0\.0\.1:|localhost:/.test(buf) || buf.includes(`:${port}`)) {
        clearTimeout(timer);
        child.stdout?.off("data", onData);
        child.stderr?.off("data", onData);
        resolve(buf);
      }
    };
    child.stdout?.on("data", onData);
    child.stderr?.on("data", onData);
    child.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`wrangler exited ${code} before ready\n${buf}`));
    });
  });
}

async function applyMigrations(persistDir) {
  const child = spawn(
    "npx",
    ["wrangler", "d1", "migrations", "apply", "lifts", "--local", "--persist-to", persistDir],
    { cwd: root, env: { ...process.env, CI: "1" }, stdio: ["ignore", "pipe", "pipe"] },
  );
  const [stdout, stderr] = await Promise.all([
    (async () => {
      let s = "";
      for await (const c of child.stdout) s += c;
      return s;
    })(),
    (async () => {
      let s = "";
      for await (const c of child.stderr) s += c;
      return s;
    })(),
  ]);
  const code = await once(child, "exit").then(([c]) => c);
  if (code !== 0) throw new Error(`migrations apply failed (${code}): ${stdout}\n${stderr}`);
}

async function startWrangler(port, persistDir, extraEnv = {}) {
  await applyMigrations(persistDir);
  const child = spawn(
    "npx",
    ["wrangler", "dev", "--local", "--port", String(port), "--persist-to", persistDir],
    {
      cwd: root,
      env: { ...process.env, ...extraEnv },
      stdio: ["ignore", "pipe", "pipe"],
      detached: true,
    },
  );
  try {
    await waitForReady(child, port);
  } catch (err) {
    treeKill(child, "SIGTERM");
    throw err;
  }
  return child;
}

function treeKill(child, signal = "SIGTERM") {
  if (!child?.pid) return;
  try {
    process.kill(-child.pid, signal);
  } catch {
    try {
      child.kill(signal);
    } catch {
      /* already gone */
    }
  }
}

async function stop(child) {
  if (!child || child.exitCode != null) return;
  treeKill(child, "SIGTERM");
  try {
    await Promise.race([once(child, "exit"), new Promise((r) => setTimeout(r, 4000))]);
  } catch {
    /* ignore */
  }
  if (child.exitCode == null) treeKill(child, "SIGKILL");
}

const port = 8799;
const persist = path.join(root, ".wrangler", "test-api");
await rm(persist, { recursive: true, force: true });
await rm(path.join(root, ".wrangler", "test-api-locked"), { recursive: true, force: true });
const base = `http://127.0.0.1:${port}`;
let child;

try {
  child = await startWrangler(port, persist);

  const health = await fetch(`${base}/health`);
  assert(health.status === 200 && (await health.text()) === "ok", "/health is 200 ok");

  const state1 = await (await fetch(`${base}/api/state`)).json();
  assert(state1.store.sessions.length === 0, "fresh D1 has no sessions");
  assert(state1.store.progress.squat.nextWeight === null, "fresh D1 invents no starting weights");
  assert(state1.localImportDone === false, "local import not done on a fresh store");

  const startRes = await fetch(`${base}/api/starting-weights`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      weights: { squat: 135, bench: 95, row: 95, ohp: 65, deadlift: 185 },
    }),
  });
  const started = await startRes.json();
  assert(startRes.status === 200 && started.store.progress.squat.nextWeight === 135, "starting weights persist");

  const doneA = {
    kind: "A",
    lifts: [
      { lift: "squat", prescribedWeight: 135, prescribedSets: 5, prescribedReps: 5, weight: 135, sets: five, notes: "" },
      { lift: "bench", prescribedWeight: 95, prescribedSets: 5, prescribedReps: 5, weight: 95, sets: five, notes: "" },
      { lift: "row", prescribedWeight: 95, prescribedSets: 5, prescribedReps: 5, weight: 95, sets: five, notes: "easy" },
    ],
    completedAt: "2026-11-11T16:00:00Z",
  };
  const workoutRes = await fetch(`${base}/api/workouts`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(doneA),
  });
  const workout = await workoutRes.json();
  assert(workoutRes.status === 200, `complete A is 200 (got ${workoutRes.status} ${JSON.stringify(workout)})`);
  assert(workout.store.progress.squat.nextWeight === 140, "rules ran server-side, squat +5");
  assert(workout.store.sessions.length === 1, "session stored");
  assert(workout.session.lifts[2].notes === "easy", "notes stored");

  const badKind = await fetch(`${base}/api/workouts`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(doneA),
  });
  assert(badKind.status === 409, "wrong rotation is 409");

  const pending1 = await (await fetch(`${base}/api/vault/pending`)).json();
  assert(pending1.items.length === 1, "completed workout is queued for the vault");
  assert(pending1.items[0].session.kind === "A", "pending payload includes the session");

  const limited = await (await fetch(`${base}/api/vault/pending?limit=1`)).json();
  assert(limited.items.length === 1, "limit=1 returns one item");
  const pendingMethod = await fetch(`${base}/api/vault/pending`, { method: "POST" });
  assert(pendingMethod.status === 405, "POST /api/vault/pending is 405");
  const ackMethod = await fetch(`${base}/api/vault/ack`, { method: "GET" });
  assert(ackMethod.status === 405, "GET /api/vault/ack is 405");

  const id = pending1.items[0].id;
  const ack1 = await (
    await fetch(`${base}/api/vault/ack`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    })
  ).json();
  assert(ack1.ok && ack1.updated === 1, "ack updates the pending row");
  const ack2 = await (
    await fetch(`${base}/api/vault/ack`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    })
  ).json();
  assert(ack2.ok && ack2.updated === 1, "second ack is idempotent and still reports the row");
  const pendingAfter = await (await fetch(`${base}/api/vault/pending`)).json();
  assert(pendingAfter.items.length === 0, "acked items leave the pending list");

  const doneB = {
    kind: "B",
    lifts: [
      { lift: "squat", prescribedWeight: 140, prescribedSets: 5, prescribedReps: 5, weight: 140, sets: five, notes: "" },
      { lift: "ohp", prescribedWeight: 65, prescribedSets: 5, prescribedReps: 5, weight: 65, sets: [5, 5, 5, 5, 4], notes: "" },
      { lift: "deadlift", prescribedWeight: 185, prescribedSets: 1, prescribedReps: 5, weight: 185, sets: [5], notes: "" },
    ],
  };
  const bRes = await fetch(`${base}/api/workouts`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(doneB),
  });
  const bJson = await bRes.json();
  assert(bRes.status === 200 && bJson.store.progress.ohp.nextWeight === 65, "OHP miss repeats weight server-side");
  const pendingB = await (await fetch(`${base}/api/vault/pending?limit=10`)).json();
  assert(pendingB.items.length === 1 && pendingB.items[0].session.kind === "B", "B is pending, acked A is not");

  const exported = await (await fetch(`${base}/api/export`)).json();
  assert(exported.version === 2 && exported.sessions.length === 2, "export is version 2 with both sessions");
  assert(exported.draft === null, "export drops the draft");

  const imported = await fetch(`${base}/api/import`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ json: JSON.stringify(v1), source: "localStorage" }),
  });
  const importedJson = await imported.json();
  assert(imported.status === 200, `v1 import is 200 (got ${imported.status})`);
  assert(importedJson.store.version === 2, "v1 import migrates to v2");
  assert(importedJson.store.sessions.length === 1 && importedJson.store.sessions[0].id === "v1-sess", "v1 session kept");
  assert(importedJson.store.sessions[0].lifts[0].prescribedWeight === 135, "v1 prescribed fields filled");
  assert(importedJson.localImportDone === true, "localStorage import marked done");
  const pendingImport = await (await fetch(`${base}/api/vault/pending`)).json();
  assert(pendingImport.items.length === 1 && pendingImport.items[0].sessionId === "v1-sess", "imported session is queued");

  const settings = await fetch(`${base}/api/settings`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ barWeightLbs: 45, plates: [45, 25, 10, 5, 2.5, 1.25] }),
  });
  const settingsJson = await settings.json();
  assert(settings.status === 200 && settingsJson.store.settings.plates.includes(1.25), "settings persist 1.25 plates");

  const draftRes = await fetch(`${base}/api/draft`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      draft: {
        kind: "B",
        entries: {
          squat: { weight: 140, sets: five, notes: "", confirmed: true, overrideOpen: false },
          ohp: { weight: 65, sets: [null, null, null, null, null], notes: "", confirmed: false, overrideOpen: true },
          deadlift: { weight: 185, sets: [null], notes: "", confirmed: false, overrideOpen: false },
        },
      },
    }),
  });
  const draftJson = await draftRes.json();
  assert(draftRes.status === 200 && draftJson.store.draft.entries.ohp.overrideOpen === true, "draft override flag persists");

  await stop(child);

  const lockedPersist = path.join(root, ".wrangler", "test-api-locked");
  const lockedPort = 8800;
  const lockedBase = `http://127.0.0.1:${lockedPort}`;
  const varsPath = path.join(root, ".dev.vars");
  await writeFile(
    varsPath,
    "ACCESS_AUD=test-aud\nACCESS_TEAM_DOMAIN=example.cloudflareaccess.com\n",
    "utf8",
  );
  try {
    child = await startWrangler(lockedPort, lockedPersist);
    const locked = await fetch(`${lockedBase}/api/vault/pending`);
    assert(locked.status === 401, `no Access header is 401 when bypass is impossible (got ${locked.status})`);
    const lockedState = await fetch(`${lockedBase}/api/state`);
    assert(lockedState.status === 401, "no Access header is 401 on /api/state too");
  } finally {
    await writeFile(varsPath, "LIFTS_DEV_BYPASS_ACCESS=1\n", "utf8");
    await stop(child);
  }

  console.log(`ok: ${passed} api assertions (state, complete, vault pending/ack/limit/405, v1 import, settings, draft, 401)`);
} catch (err) {
  await stop(child);
  await writeFile(path.join(root, ".dev.vars"), "LIFTS_DEV_BYPASS_ACCESS=1\n", "utf8").catch(() => {});
  throw err;
}
