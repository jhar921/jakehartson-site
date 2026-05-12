# RP: jakehartson.com v2 (design pass)

**Status:** Complete
**Run date:** 2026-05-12
**Notion page:** https://www.notion.so/762589700d2144518ef7401e186834e3

## Objective

One opinionated design pass. No copy changes. No structural changes. Tighten visual hierarchy, spacing, typography, photo treatment, and CTA styling.

## Stack

Astro 6.x + Tailwind 4.x. Netlify auto-deploy from GitHub main.

## Section order

1. Hero
2. How I can help
3. Want to talk?
4. Not ready to text?
5. About
6. Writing, start here
7. Footer

## Key design system (v2)

- **Type scale:** `.type-display` clamp(1.875rem, 5vw, 2.625rem) | `.type-h2` clamp(1.375rem, 3vw, 1.75rem) | `.type-h3` clamp(1.0625rem, 2vw, 1.25rem)
- **Spacing:** `--section-y: clamp(3rem, 6vw, 4.5rem)` | `--section-x: 1.5rem`
- **Yellow accent (4 contexts only):** primary CTA bg, link underlines (`.link-inline`), Hero eyebrow text, focus rings
- **Photos:** `rounded-2xl + shadow-md` on both hero and family photo
- **Focus:** Universal `:focus-visible` outline in honey, 2px, offset 3px
- **Line length:** `.prose-body` = `max-width: 65ch` on body paragraphs

## Post-Build Log

| Field | Notes |
|---|---|
| Session date | 2026-05-12 |
| Status | Complete |
| What shipped | Fluid type scale, CSS spacing vars, unified link utility, photo shadows, focus rings, 65ch body cap, yellow trimmed to 4 contexts |
| What's left | DNS wiring (Jake) + Lighthouse verification (pending custom domain) |
| Issues | None |
| Deployed URL | https://jakehartson-site.netlify.app |
