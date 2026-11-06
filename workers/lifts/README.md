# lifts — StrongLifts 5×5 tracker (Worker)

Personal tool for **lifts.jakehartson.com** (subdomain root). HUD glance tokens
(D-DIN + JetBrains Mono, dark/light). No third-party logos, wordmarks, mission names, or
trademarks. Data stays in `localStorage` only.

## Status

- Live at **https://lifts.jakehartson.com/** as the standalone `lifts` Worker, behind
  Cloudflare Access (allow `jake@jakehartson.com` only). `workers.dev` and preview URLs are off.
- Not part of the jakehartson.com Astro site; there is no `/lifts/` page there.
- The Worker runs first on every request (`run_worker_first`) and adds noindex, CSP
  (inline scripts pinned by SHA-256), HSTS, and other security headers. If you edit an
  inline `<script>` in `public/index.html`, update its hash in `src/worker.js`.
- Tests: `npm run check` (imports `public/lifts-domain.js`).

## Local preview

```bash
cd workers/lifts
npm install
npm run preview   # static: http://127.0.0.1:8788/
# or: npx wrangler dev --local --port 8788
```

## Features

A/B next workout · log weight/sets/reps/notes · progression (+5 squat/DL, +2.5 upper;
fail repeat; 10% deload after 3) · history · Export/Import JSON · theme `lifts-theme`.

## Fonts

Self-hosted under `public/fonts/` (SIL OFL 1.1). See `OFL.txt`.
