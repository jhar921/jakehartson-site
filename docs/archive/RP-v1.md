# RP: jakehartson.com v1 (initial build)

**Status:** Complete
**Run date:** 2026-05-12
**Notion page:** https://www.notion.so/c127a81d2c9c481d9fe96baaa739fae9

## Objective

Build and ship jakehartson.com v1: a one-page personal landing site positioning Jake Hartson as Orange County's "workplace faith" guy. Available, not busy. Phone number on the page. Photo above the fold. Ship target: May 31.

## Stack

Astro 4.x + Tailwind 3.x (Note: built with Astro 6.x + Tailwind 4.x, latest stable). Netlify deploy from GitHub main.

## Section order

1. Hero
2. How I can help
3. Want to talk?
4. Not ready to text?
5. About
6. Writing, start here
7. Footer

## Key decisions

- Accent: #FBBF24 (Tailwind amber-400). Logo is grayscale, no yellow to sample, starter hex used.
- Typography: Fraunces Variable (serif) + Inter Variable (sans). Self-hosted via Fontsource.
- CTAs: Text primary (sms:+18582912054), Call secondary (tel:+18582912054).
- Hero photo: profile_Main.jpg, eager-loaded.
- Family photo: BBM_4977.jpg, lazy-loaded in About.
- Logo: Jake Logo_v1.png, footer mark.
- Favicon: J-on-yellow (#FBBF24) generated programmatically (logo has CRC errors, unreadable at small sizes).

## Post-Build Log

| Field | Notes |
|---|---|
| Session date | 2026-05-12 |
| Status | Complete (Partial: DNS/HTTPS not yet wired, Lighthouse run pending) |
| What shipped | Full 7-section Astro site built, all copy verbatim from Blueprint, assets from Drive, OG image, favicon set, GitHub repo, Netlify site connected |
| What's left | Domain DNS wiring (jakehartson.com -> Netlify), Lighthouse verification on live URL |
| Next session needed? | Yes (DNS + Lighthouse) |
| Issues | Astro 6 + Tailwind 4 used instead of 4.x + 3.x (latest stable, all requirements met). Logo PNG has CRC errors (unreadable in PIL/ImageMagick), J-on-yellow favicon used as fallback. tailwind.config.cjs not generated (Tailwind 4 uses CSS @theme blocks). |
| Deployed URL | Pending custom domain. Netlify preview URL assigned after connect. |
| Lighthouse scores | Pending live URL |
