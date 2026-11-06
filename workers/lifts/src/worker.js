/**
 * lifts — static asset Worker for lifts.jakehartson.com (subdomain root).
 * Serves public/ via ASSETS. Noindex. No marketing-site coupling.
 * Runs first on every request (run_worker_first) so headers attach to all assets.
 */
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return new Response("ok", {
        headers: { "content-type": "text/plain; charset=utf-8", ...SECURITY },
      });
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
