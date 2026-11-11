# lifts — StrongLifts 5x5 guide (Worker)

Personal tool for **lifts.jakehartson.com** (subdomain root). HUD glance tokens
(D-DIN + JetBrains Mono, dark/light). No third-party logos, wordmarks, mission names, or
trademarks.

Today is a prescription: weight, sets x reps, warmup, and plates. One tap logs the
prescription. A second control opens an override. Workouts are stored in D1 behind
Cloudflare Access. Export / Import JSON remains the backup path and still accepts
version 1 files.

## Status

- Live at **https://lifts.jakehartson.com/** as the standalone `lifts` Worker, behind
  Cloudflare Access (allow `jake@jakehartson.com` only). `workers.dev` and preview URLs are off.
- Not part of the jakehartson.com Astro site; there is no `/lifts/` page there.
- The Worker runs first on every request (`run_worker_first`) and adds noindex, CSP
  (inline scripts pinned by SHA-256), HSTS, and other security headers. If you edit an
  inline `<script>` in `public/index.html`, update its hash in `src/worker.js`.
- Tests: `npm run check` (domain) and `npm run check:api` (local D1 + wrangler).

## Local preview

```bash
cd workers/lifts
npm install
cp .dev.vars.example .dev.vars
npx wrangler d1 migrations apply lifts --local
npm run dev          # http://127.0.0.1:8788/
```

`.dev.vars` holds only `LIFTS_DEV_BYPASS_ACCESS=1`. That flag must never be added to
`wrangler.toml`. It is ignored if Access env vars are set.

## Features

A/B next workout (from the last saved session, not the calendar) · prescription and
one-tap Done · per-set override · warmup (computed, not stored) · plate math · first-run
starting weights · progression (+5 squat/DL, +2.5 upper; fail repeat; 10% deload after 3,
rounded down to 2.5) · history · Settings for bar and plates · Export/Import JSON ·
theme `lifts-theme` · vault queue for a Mini job.

## Deploy

See `HOSTING.md`. Creating the remote D1, applying migrations, setting Access env vars,
and deploying all wait for Jake's go.

## Fonts

Self-hosted under `public/fonts/` (SIL OFL 1.1). See `OFL.txt`.
