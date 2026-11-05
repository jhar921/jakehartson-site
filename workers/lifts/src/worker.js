/**
 * lifts — static asset Worker for lifts.jakehartson.com (subdomain root).
 * Serves public/ via ASSETS. Noindex. No marketing-site coupling.
 * Deploy + DNS only after Jake's explicit go via Cooper.
 */
const SECURITY = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "x-robots-tag": "noindex, nofollow",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
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
