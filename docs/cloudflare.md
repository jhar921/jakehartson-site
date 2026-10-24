# Cloudflare hosting notes

jakehartson.com is served by the Cloudflare Pages project `jakehartson-site`
(direct upload of `dist/`, production branch `main`). `vercel.json` is no longer
read by anything; `public/_headers` carries its vCard headers for Pages.

## What Pages does with the build

- `dist/404.html` is served with HTTP 404 for any path with no matching file.
- `dist/card/index.html` is served at `/card/`; `/card` gets a 301 to `/card/`.
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

The `_worker.js` bundle (`scripts/pages-worker.mjs`) also 301s
`www.jakehartson.com` to the apex, so the redirect holds even without the rule.

## Contact form

- The form on `/` posts to `/api/contact`. The Pages worker passes the request
  to the `CONTACT` service binding (Pages project setting), which points at the
  `jakehartson-contact` Worker (`workers/contact/index.js`).
- That Worker verifies the Turnstile token (widget `jakehartson.com contact`,
  hostnames `jakehartson.com` and `jakehartson-site.pages.dev`), drops honeypot
  hits, and sends through a `send_email` binding locked to
  `jake@jakehartson.com` (a verified Email Routing destination address), with
  Reply-To set to the visitor.
- The sender must be on a domain with Email Routing enabled.
  `jakehartson.com` keeps its Google MX and does not have Email Routing, so
  the sender is set by the `FROM_ADDRESS` variable.
- The public site key is set in `src/components/Contact.astro`; the secret is
  the Worker secret `TURNSTILE_SECRET`.
