# lifts — StrongLifts 5×5 tracker (Worker)

Personal tool for **lifts.jakehartson.com** (subdomain root). HUD glance tokens
(D-DIN + JetBrains Mono, dark/light). No third-party logos, wordmarks, mission names, or
trademarks. Data stays in `localStorage` only.

## Status

- **Draft / preview only.** Do not deploy. Do not change DNS. No production traffic.
- Go-live needs Jake’s explicit go via Cooper. See `/workspace/stronglifts-5x5/SUBDOMAIN-PLAN.md`.

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
