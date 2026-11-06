# Hosting

Canonical host: **https://lifts.jakehartson.com/** (subdomain root), Worker `lifts`,
behind Cloudflare Access. Not `jakehartson.com/lifts/`; the earlier Astro route was removed.
Deploy from this directory with `npx wrangler deploy` (keeps `workers_dev = false`, `preview_urls = false`).
