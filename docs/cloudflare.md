# Cloudflare hosting notes

jakehartson.com is served by the Cloudflare Pages project `jakehartson-site`
(direct upload of `dist/`, production branch `main`). `vercel.json` is no longer
read by anything; `public/_headers` carries its vCard headers for Pages.

## What Pages does with the build

- `dist/404.html` is served with HTTP 404 for any path with no matching file.
- `dist/card/index.html` is served at `/card/`; `/card` gets a 308 to `/card/`.
- `dist/_headers` sets the vCard content type and filename.

## www to apex (needs a zone rule, not code)

Pages `_redirects` cannot match on hostname, so the www redirect has to be a
Cloudflare Redirect Rule on the `jakehartson.com` zone:

- Rules > Redirect Rules > Create rule (Single Redirect)
- When incoming requests match: custom filter `(http.host eq "www.jakehartson.com")`
- Then: Dynamic redirect
  - Expression: `concat("https://jakehartson.com", http.request.uri.path)`
  - Status code: 301
  - Preserve query string: on

Keep `www.jakehartson.com` attached to the Pages project (proxied DNS record) so
the rule has something to run in front of.
