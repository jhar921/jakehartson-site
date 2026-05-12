# RP: jakehartson.com v2 (design pass)

**Status:** Complete
**Run date:** 2026-05-12
**Notion page:** https://www.notion.so/762589700d2144518ef7401e186834e3

## Objective

One opinionated design pass. No copy changes. No structural changes. Tighten visual hierarchy, spacing, typography, photo treatment, and CTA styling.

## Changes made

- `global.css`: Added `:root` CSS custom properties (`--section-y` clamp, `--section-x`). Added `@layer utilities` with `.type-display`, `.type-h2`, `.type-h3` (1.333-ratio fluid scale via `clamp()`), `.link-inline` (consolidated honey underline utility), `.prose-body` (65ch max-width). Universal `:focus-visible` ring in honey amber.
- `Hero.astro`: H1 uses `type-display` (fluid `clamp(1.875rem, 5vw, 2.625rem)`). Hero photo gets `rounded-2xl + shadow-md`. CTA buttons get `min-h-[44px]`. Body paragraph gets `prose-body`. Section padding via CSS var.
- `HowICanHelp.astro`: Eyebrow changed from `text-honey` to `text-gray-500` (yellow accent trimmed). H3s use `type-h3`. Paragraphs capped at 65ch.
- `WantToTalk.astro`: H2 uses `type-h2`. 44px tap targets on CTAs. Prose-body on paragraphs.
- `NotReadyToText.astro`: H2 added with `type-h2`. Link uses `link-inline`.
- `About.astro`: H2 uses `type-h2`. Family photo gets `rounded-2xl + shadow-md` (matches hero). Links use `link-inline`.
- `WritingStartHere.astro`: H2 uses `type-h2`. Article title links use `type-h3 link-inline`. Descriptions step to `text-gray-500`.
- `SiteFooter.astro`: Logo gets `opacity-70`. Footer text steps to `gray-400`. Email link uses `link-inline`.

## Yellow accent inventory (4 contexts)

1. Primary CTA button background (`bg-honey` / `hover:bg-honey-dark`)
2. Inline link underlines (`.link-inline` -- `text-decoration-color: honey`)
3. Hero eyebrow label (`text-honey`)
4. Focus rings (`:focus-visible` outline in honey)

## Commits

- `468a77c` design: add fluid type scale, spacing variables, focus rings, link utility
- `ae5cd8f` design(hero): fluid H1, photo shadow, 44px tap targets, prose-body
- `1d4de1a` design(sections): type scale, desaturate eyebrow, consistent spacing
- `69d4191` design(lower sections): type scale, photo shadow, link-inline, footer

## Post-Build Log

| Field | Notes |
|---|---|
| Session date | 2026-05-12 |
| Status | Complete |
| What shipped | Full design pass: fluid type scale, unified spacing vars, focus rings, photo shadow treatment, 65ch body width, yellow accent trimmed to 4 contexts, .link-inline utility |
| What's left | None. DNS wiring and Lighthouse verification remain from v1 (Jake's task). |
| Issues | None |
| Deployed URL | https://jakehartson-site.netlify.app (auto-deploy triggered on push to main) |
