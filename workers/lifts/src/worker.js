/**
 * lifts — Worker for lifts.jakehartson.com (subdomain root).
 * Serves public/ via ASSETS. /api/* talks to local or bound D1.
 * Noindex. No marketing-site coupling.
 * Runs first on every request (run_worker_first) so headers attach to all assets.
 */
import { exportJson, defaultSettings } from "../public/lifts-domain.js";
import { requireAccess } from "./auth.js";
import {
  ackVault,
  completeWorkout,
  getMeta,
  loadStore,
  pendingVault,
  mergeFromImport,
  saveDraft,
  saveSettings,
  saveStartingWeights,
} from "./db.js";

const SECURITY = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "x-robots-tag": "noindex, nofollow",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
  "x-frame-options": "DENY",
  "strict-transport-security": "max-age=31536000",
  // Inline scripts in index.html are allowed by hash; update hashes if they change.
  "content-security-policy":
    "default-src 'none'; script-src 'self' 'sha256-Nv/xAGm5zFyNXfczkP33y17uEAu5gKfLk214/2A0PHw=' 'sha256-ADdv50wPPkzx3+kUQepz9IYCvTxfCWwzL/wEQHt3TjM='; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; manifest-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'",
};

function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...SECURITY,
      ...extra,
    },
  });
}

function text(body, status = 200) {
  return new Response(body, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", ...SECURITY },
  });
}

async function readJson(request) {
  try {
    return { ok: true, body: await request.json() };
  } catch {
    return { ok: false };
  }
}

async function statePayload(env) {
  const store = await loadStore(env.DB);
  const localImportDone = (await getMeta(env.DB, "local_import_done")) === "1";
  return { store, localImportDone };
}

async function handleApi(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const method = request.method.toUpperCase();

  if (path === "/api/state") {
    if (method !== "GET") return json({ error: "Method not allowed" }, 405);
    return json(await statePayload(env));
  }

  if (path === "/api/draft") {
    if (method !== "PUT") return json({ error: "Method not allowed" }, 405);
    const read = await readJson(request);
    if (!read.ok || !read.body?.draft) return json({ error: "Invalid draft" }, 400);
    await saveDraft(env.DB, read.body.draft);
    return json(await statePayload(env));
  }

  if (path === "/api/workouts") {
    if (method !== "POST") return json({ error: "Method not allowed" }, 405);
    const read = await readJson(request);
    if (!read.ok || !read.body || !Array.isArray(read.body.lifts) || (read.body.kind !== "A" && read.body.kind !== "B")) {
      return json({ error: "Invalid workout" }, 400);
    }
    const result = await completeWorkout(env.DB, read.body.kind, read.body.lifts, read.body.completedAt);
    if (!result.ok) return json({ error: result.message }, result.status || 400);
    const payload = await statePayload(env);
    return json({ ...payload, session: result.session });
  }

  if (path === "/api/starting-weights") {
    if (method !== "POST") return json({ error: "Method not allowed" }, 405);
    const read = await readJson(request);
    if (!read.ok || !read.body?.weights) return json({ error: "Invalid starting weights" }, 400);
    const result = await saveStartingWeights(env.DB, read.body.weights);
    if (!result.ok) return json({ error: result.message }, 400);
    return json(await statePayload(env));
  }

  if (path === "/api/settings") {
    if (method === "GET") {
      const store = await loadStore(env.DB);
      return json({ settings: store.settings ?? defaultSettings() });
    }
    if (method !== "PUT") return json({ error: "Method not allowed" }, 405);
    const read = await readJson(request);
    if (!read.ok || !read.body) return json({ error: "Invalid settings" }, 400);
    const bar = Number(read.body.barWeightLbs);
    const plates = Array.isArray(read.body.plates) ? read.body.plates.map(Number) : null;
    if (!Number.isFinite(bar) || bar <= 0) return json({ error: "Enter a bar weight." }, 400);
    if (!plates || !plates.length || plates.some((p) => !Number.isFinite(p) || p <= 0)) {
      return json({ error: "Enter at least one plate." }, 400);
    }
    await saveSettings(env.DB, { barWeightLbs: bar, plates });
    return json(await statePayload(env));
  }

  if (path === "/api/export") {
    if (method !== "GET") return json({ error: "Method not allowed" }, 405);
    const store = await loadStore(env.DB);
    return new Response(exportJson(store), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "content-disposition": `attachment; filename="stronglifts-5x5-${new Date().toISOString().slice(0, 10)}.json"`,
        ...SECURITY,
      },
    });
  }

  if (path === "/api/import") {
    if (method !== "POST") return json({ error: "Method not allowed" }, 405);
    const read = await readJson(request);
    const textBody = typeof read.body?.json === "string" ? read.body.json : read.body ? JSON.stringify(read.body.data ?? read.body) : null;
    if (!read.ok || !textBody) return json({ error: "Invalid backup JSON" }, 400);
    try {
      const markLocalImport = read.body?.source === "localStorage";
      const result = await mergeFromImport(env.DB, textBody, { markLocalImport });
      return json({ ...(await statePayload(env)), importSummary: result.summary });
    } catch {
      return json({ error: "Invalid backup JSON" }, 400);
    }
  }

  if (path === "/api/vault/pending") {
    if (method !== "GET") return json({ error: "Method not allowed" }, 405);
    const items = await pendingVault(env.DB, url.searchParams.get("limit"));
    return json({ items });
  }

  if (path === "/api/vault/ack") {
    if (method !== "POST") return json({ error: "Method not allowed" }, 405);
    const read = await readJson(request);
    if (!read.ok || !Array.isArray(read.body?.ids)) return json({ error: "ids required" }, 400);
    const result = await ackVault(env.DB, read.body.ids);
    return json(result);
  }

  return json({ error: "Not found" }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return new Response("ok", {
        headers: { "content-type": "text/plain; charset=utf-8", ...SECURITY },
      });
    }

    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      if (!env.DB) return json({ error: "Database unavailable" }, 500);
      const access = await requireAccess(request, env);
      if (!access.ok) return json({ error: access.message }, access.status);
      try {
        return await handleApi(request, env);
      } catch (err) {
        console.error("api error", err?.message || err);
        return json({ error: "Server error" }, 500);
      }
    }

    let res = await env.ASSETS.fetch(request);
    if (res.status === 404 && (url.pathname === "" || url.pathname === "/")) {
      const indexReq = new Request(new URL("/index.html", url.origin), request);
      res = await env.ASSETS.fetch(indexReq);
    }

    if (res.status === 404) {
      return new Response("Not found", {
        status: 404,
        headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", ...SECURITY },
      });
    }

    const headers = new Headers(res.headers);
    for (const [k, v] of Object.entries(SECURITY)) headers.set(k, v);
    if ((headers.get("content-type") || "").includes("text/html")) {
      headers.set("cache-control", "no-store");
    } else if (url.pathname.startsWith("/fonts/")) {
      headers.set("cache-control", "public, max-age=31536000, immutable");
    }

    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  },
};
