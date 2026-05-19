# The Clarity Company — Brand Guide v1

## Visual Standard

This guide defines the brand system for **The Clarity Company** and all sub-brands (Clarity Audit, Clarity Intensive, Clarity Ops). Every asset, page, email, and deliverable should feel like it belongs on jakehartson.com and clarity-ops-site.netlify.app.

**Brand personality in five words:** Clean. Confident. Honest. Warm. Sharp.

---

## 1. Color Palette

| Role | Name | Hex | Usage |
|---|---|---|---|
| Primary Text | Ink | `#1A1A1A` | Headings, body copy, wordmark. The default color for everything. |
| Background | Paper | `#FFFFFF` | Page backgrounds, cards, containers. Always pure white. |
| Warm Background | Linen | `#FAFAF7` | Alternate section backgrounds, callout cards. Adds warmth without color. |
| Secondary Text | Stone | `#6B6B6B` | Subheadings, captions, labels, metadata, secondary body text. |
| Borders / Rules | Mist | `#E5E5E5` | Dividers, card borders, table rules. Subtle separation only. |
| Accent | Signal | `#2563EB` | Links, CTAs, buttons, interactive elements. Used sparingly for action. |
| Accent Hover | Signal Dark | `#1D4ED8` | Hover/active state for links and buttons. |
| Success / Proof | Proof | `#16A34A` | Checkmarks, "included" lists, positive indicators. Never for text. |
| Warning / Urgency | Ember | `#DC2626` | Urgency badges, error states. Extremely rare. |

### Color Rules

- **90% of the brand is Ink on Paper.** The palette exists to support the text, not compete with it.
- Accent (Signal) appears only on interactive elements: links, buttons, CTAs. Never on headings or body text.
- Never use more than two colors on a single section. Ink + one accent max.
- Dark backgrounds are not part of this brand. If you need contrast, use Linen, not a dark section.
- Avoid colored backgrounds behind text blocks. Let whitespace do the work.

---

## 2. Typography

| Role | Typeface |
|---|---|
| Headings | Inter |
| Body | Inter |
| Small / Labels | Inter |
| Code / Technical | JetBrains Mono |
| Fallback Stack | Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif |

### Typography Rules

- **One typeface family.** Inter handles everything. No mixing font families.
- **Sentence case for all headings.** "Stop running your business on duct tape." not "Stop Running Your Business On Duct Tape."
- **No ALL CAPS in body content.** The wordmark is the only exception.
- **Generous line height.** 1.6 to 1.7 for body. The sites feel spacious because the text breathes.
- **Max line width: 680px.** Single-column, never wider. This is what makes both sites feel focused and readable.
- **Bold for emphasis, not color.** When you need to highlight a word or phrase, use `font-weight: 600`. Don't reach for accent colors in body text.

---

## 3. Logo / Wordmark

### Primary Wordmark

Logo file: `assets/clarity-wordmark.png`

**Construction:** Three-line stack. "THE" in tracked-out uppercase (smallest), "CLARITY" as the dominant word (largest, medium weight), "COMPANY" in uppercase below (mid-size, lighter weight). All set in a geometric sans-serif.

### Monogram / Icon Mark

Logo file: `assets/clarity-monogram.png`

**Usage:** Favicon, social avatars, app icons, small-format placements where the full wordmark won't fit.

### Logo Rules

- **Always Ink (#1A1A1A) on Paper (#FFFFFF).** No color versions. No inverted versions on dark backgrounds (the brand doesn't use dark backgrounds).
- **Minimum clear space:** Height of the "T" in "THE" on all sides.
- **Never recreate the wordmark in a different typeface.** If you can't use the asset file, use plain text "The Clarity Company" in Inter Medium.
- **No taglines locked to the logo.** Taglines live in copy, not in the mark.
- **Sub-brand lockups** follow the same pattern: "Clarity Audit", "Clarity Ops", "Clarity Intensive" in the same typographic style, never with separate logos or icons.

> **Note on production logos:** These are AI-generated concept renders. For final production use (print, high-res web, SVG), commission vector versions from a type designer or vectorize in Illustrator. The direction, weight, and spacing shown here are the spec.

---

## 4. Layout Principles

- **Single column, centered.** Both reference sites use one column, max 680px content width. No sidebars, no multi-column grids for content.
- **Generous vertical spacing.** Sections separated by 80-120px of whitespace. Let the page breathe.
- **No hero images.** The hero is always a headline. Text is the visual.
- **No stock photos. Ever.** The only photos are real (Jake, family, team). If no real photo exists, use whitespace.
- **Mobile-first by default.** Single column means it's already responsive. Don't add complexity that breaks on mobile.
- **Cards are flat.** No drop shadows, no rounded corners > 8px, no gradients. Borders use Mist (#E5E5E5) at 1px, or no border at all.

---

## 5. Voice & Copy Style

- **Plain, warm, conversational.** Write like you talk. Short sentences. No jargon.
- **Confident, not salesy.** State value directly. No hype words ("revolutionary", "game-changing", "unlock your potential").
- **Never use em dashes.** Use commas, periods, colons, or parentheses. No exceptions.
- **Sentence case everywhere.** Headings, buttons, navigation, CTAs.
- **Second person default.** "You" not "our clients" or "one".
- **Specificity over abstraction.** "90 minutes on Zoom" not "a focused session". "$997" not "affordable investment".

---

## 6. Sub-Brand Usage

| Sub-Brand | Positioning | Visual Treatment |
|---|---|---|
| Clarity Audit | Primary offer. $997 diagnostic. | "Clarity Audit" in Inter Medium. No separate logo. On the site, it's a section heading, not a brand. |
| Clarity Intensive | Hidden upsell. Equity/performance. | Same treatment. Never surfaced publicly unless a Tier 1 audit client is a candidate. |
| Clarity Ops | Done-for-you (deferred Year 1). | Same treatment. Currently the live site at clarity-ops-site.netlify.app. |

All sub-brands inherit the parent brand system entirely. No unique colors, no unique fonts, no unique icons. The differentiator is the name and the copy, not the visual.

---

## 7. Reference Sites

These two sites are the visual standard. When in doubt, match them.

- **jakehartson.com** — personal/ministry site. The purest expression of the brand: text-forward, conversational, whitespace-heavy, zero decoration.
- **clarity-ops-site.netlify.app** — business site. Same DNA with slightly more structure (pricing cards, framework boxes, FAQ accordion). Still single-column, still text-first.

---

## 8. Quick-Reference CSS Variables

```css
:root {
  /* Colors */
  --color-ink: #1A1A1A;
  --color-paper: #FFFFFF;
  --color-linen: #FAFAF7;
  --color-stone: #6B6B6B;
  --color-mist: #E5E5E5;
  --color-signal: #2563EB;
  --color-signal-dark: #1D4ED8;
  --color-proof: #16A34A;
  --color-ember: #DC2626;

  /* Typography */
  --font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  --font-size-base: 16px;
  --font-size-small: 14px;
  --line-height: 1.65;
  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;

  /* Layout */
  --content-max-width: 680px;
  --section-spacing: 96px;
  --border-radius: 6px;
}
```

---

## 9. Logo Assets

Logo PNG files are stored in `assets/` alongside this file.

- `assets/clarity-wordmark.png` — full three-line wordmark
- `assets/clarity-monogram.png` — "C" monogram / icon mark

**Source:** AI-generated concept renders exported from the Notion brand guide page. For production-quality SVG or print-ready files, commission vector versions from a type designer.
