/**
 * Pull pending lifts workouts and write one markdown note per session
 * into the jake vault (2 DATABASES/Workouts). Ack only after a successful write.
 *
 * Never prints secrets. Never overwrites an existing note for a different workout.
 * Skip if the same workout_id is already present in the folder.
 *
 * Config comes from an env file (chmod 600) or macOS Keychain. See INSTALL.md.
 *
 * Dry-run against a local Worker:
 *   LIFTS_API_BASE=http://127.0.0.1:8788 LIFTS_VAULT_DIR=/tmp/lifts-vault-dryrun \
 *     node scripts/lifts-vault-sync.mjs
 * Local wrangler must use LIFTS_DEV_BYPASS_ACCESS=1 via .dev.vars (not wrangler.toml).
 */
import { mkdir, readFile, writeFile, readdir, rename } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { homedir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { renderVaultNote, uniqueVaultFilename } from "../public/lifts-domain.js";

const DEFAULT_ENV_PATHS = [
  process.env.LIFTS_VAULT_ENV,
  path.join(homedir(), ".config", "lifts-vault-sync.env"),
  "/usr/local/etc/lifts-vault-sync.env",
].filter(Boolean);

function logLine(file, level, message) {
  const line = `${new Date().toISOString()} ${level} ${message}\n`;
  if (file) {
    return writeFile(file, line, { flag: "a", mode: 0o600 });
  }
  process.stderr.write(line);
  return Promise.resolve();
}

function parseEnvFile(text) {
  const out = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[line.slice(0, eq).trim()] = value;
  }
  return out;
}

async function loadConfig() {
  const fromFile = {};
  for (const p of DEFAULT_ENV_PATHS) {
    if (p && existsSync(p)) {
      Object.assign(fromFile, parseEnvFile(await readFile(p, "utf8")));
      break;
    }
  }
  const cfg = { ...fromFile, ...process.env };
  const apiBase = (cfg.LIFTS_API_BASE || "").replace(/\/+$/, "");
  const vaultDir = cfg.LIFTS_VAULT_DIR;
  if (!apiBase) throw new Error("LIFTS_API_BASE is required");
  if (!vaultDir) throw new Error("LIFTS_VAULT_DIR is required");
  return {
    apiBase,
    vaultDir,
    logFile: cfg.LIFTS_LOG_FILE || "",
    limit: Number(cfg.LIFTS_VAULT_LIMIT || 20),
    clientId: cfg.CF_ACCESS_CLIENT_ID || keychain(cfg.LIFTS_KEYCHAIN_SERVICE, "client-id"),
    clientSecret: cfg.CF_ACCESS_CLIENT_SECRET || keychain(cfg.LIFTS_KEYCHAIN_SERVICE, "client-secret"),
  };
}

function keychain(service, account) {
  if (!service) return "";
  const result = spawnSync("security", ["find-generic-password", "-s", service, "-a", account, "-w"], {
    encoding: "utf8",
  });
  if (result.status !== 0) return "";
  return (result.stdout || "").trim();
}

function accessHeaders(cfg) {
  const headers = { accept: "application/json" };
  if (cfg.clientId && cfg.clientSecret) {
    headers["CF-Access-Client-Id"] = cfg.clientId;
    headers["CF-Access-Client-Secret"] = cfg.clientSecret;
  }
  return headers;
}

async function api(cfg, method, pathName, body) {
  const res = await fetch(`${cfg.apiBase}${pathName}`, {
    method,
    headers: {
      ...accessHeaders(cfg),
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) throw new Error(`${method} ${pathName} failed (${res.status})`);
  return data;
}

function workoutIdFromMarkdown(text) {
  const match = text.match(/^workout_id:\s*(.+)$/m);
  return match ? match[1].trim() : "";
}

async function existingIndex(vaultDir) {
  await mkdir(vaultDir, { recursive: true });
  const names = new Set();
  const byId = new Map();
  for (const name of await readdir(vaultDir)) {
    if (!name.endsWith(".md")) continue;
    names.add(name);
    const text = await readFile(path.join(vaultDir, name), "utf8");
    const id = workoutIdFromMarkdown(text);
    if (id) byId.set(id, name);
  }
  return { names, byId };
}

async function writeAtomically(filePath, contents) {
  const tmp = `${filePath}.tmp-${process.pid}`;
  await writeFile(tmp, contents, { encoding: "utf8", mode: 0o644 });
  await rename(tmp, filePath);
}

async function main() {
  const cfg = await loadConfig();
  const log = (level, message) => logLine(cfg.logFile, level, message);
  try {
    const pending = await api(cfg, "GET", `/api/vault/pending?limit=${encodeURIComponent(cfg.limit)}`);
    const items = pending.items ?? [];
    const { names, byId } = await existingIndex(cfg.vaultDir);
    const ackIds = [];
    for (const item of items) {
      const session = item.session;
      if (!session?.id) {
        await log("warn", `skip item without session id`);
        continue;
      }
      if (byId.has(session.id)) {
        await log("info", `already written ${session.id} as ${byId.get(session.id)}; will ack`);
        ackIds.push(item.id);
        continue;
      }
      const note = renderVaultNote(session);
      const filename = uniqueVaultFilename(note.filename, names);
      const dest = path.join(cfg.vaultDir, filename);
      if (names.has(filename)) {
        await log("warn", `refusing to overwrite ${filename}`);
        continue;
      }
      await writeAtomically(dest, note.markdown);
      names.add(filename);
      byId.set(session.id, filename);
      ackIds.push(item.id);
      await log("info", `wrote ${filename} for ${session.id}`);
    }
    if (ackIds.length) {
      await api(cfg, "POST", "/api/vault/ack", { ids: ackIds });
      await log("info", `acked ${ackIds.length}`);
    } else {
      await log("info", "no pending workouts");
    }
  } catch (err) {
    await log("error", err.message || "sync failed");
    process.exitCode = 1;
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main();
}

export { loadConfig, main };
