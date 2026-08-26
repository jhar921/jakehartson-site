# Jake Hartson — Personal Brand Guide v1

## Role of this site

**jakehartson.com** is the personal marketplace trust layer: founder, strategist, and operator credibility.

It is **not** a ministry site and **not** The Clarity Company.

| Property | Audience | Job |
|---|---|---|
| **jakehartson.com** | Marketplace (founders, operators, buyers, partners) | Who Jake is, why he is credible, how to reach him |
| **Search / Search OC** | Christian / ministry | Faith conversations, ministry leadership |
| **The Clarity Company** | Business education | Generic business education products and programs |

**Hard rule:** No ministry language, Search branding, faith CTAs, or Christian newsletter links on jakehartson.com. Those live on Search properties. Clarity Company is referenced only as a related business education venture, never as the primary identity of this site.

---

## Brand personality

**Five words:** Clear. Credible. Direct. Steady. Capable.

Calm authority. Practical outcomes. Values-driven without being churchy.

---

## Color palette

| Role | Name | Hex | Usage |
|---|---|---|---|
| Primary text | Ink | `#101412` | Headings, body, wordmark |
| Background | Paper | `#F3F5F4` | Page base |
| Atmosphere | Fog | `#E4E9E6` | Gradients, section shifts |
| Secondary text | Stone | `#5A635E` | Supporting copy, meta |
| Borders | Line | `#C9D1CC` | Hairlines, dividers |
| Accent | Teal | `#0F766E` | Links, primary CTAs, focus |
| Accent hover | Teal Bright | `#0D9488` | Hover / active |

### Color rules

- Most of the brand is Ink on Paper. Atmosphere comes from soft cool gradients and the hero photo, not decoration.
- Teal is for action only: links, buttons, focus rings.
- Do not use honey yellow, cream-and-terracotta, or purple gradients on this property.
- No dark-mode-first layout. Light marketplace surface.

---

## Typography

| Role | Typeface |
|---|---|
| Display / brand / headings | Newsreader Variable |
| Body / UI | Source Sans 3 Variable |
| Fallback | Georgia, system-ui, sans-serif |

### Typography rules

- **Jake Hartson** is a hero-level brand signal, not nav-only text.
- Sentence case for headings.
- No ALL CAPS except tiny technical labels if needed.
- Body line length ~65ch.
- Never use Inter, Roboto, or Arial as the designed stack.

---

## Layout principles

- **Hero:** Full-bleed photographic plane. Brand name, one headline, one short supporting sentence, one CTA group. Nothing else in the first viewport.
- **No cards in the hero.** Cards only when they contain a real interaction.
- **One job per section.** One purpose, one headline, usually one short supporting sentence.
- **Real imagery only.** Jake portrait and family photo. No stock people.
- **Whitespace does the structure.** Prefer rhythm over borders and boxes.

---

## Voice & copy

- Plain, confident, marketplace English.
- Second person when inviting action. First person for Jake's story.
- Specificity over slogans.
- **Never use em dashes.**
- No religious jargon, scripture, or ministry framing.
- No hype words ("revolutionary", "game-changing", "unlock").

### Positioning thesis

Jake is a veteran, USC Marshall-trained strategist, and founder who helps operators get clear, decide, and execute. He builds and advises businesses in the marketplace. Search work lives elsewhere. Clarity Company is business education under a separate brand.

---

## Cross-links

| From | To | How |
|---|---|---|
| jakehartson.com | The Clarity Company | Subtle footer or ventures mention only |
| jakehartson.com | Search | **No link** on the public marketplace site |
| Clarity Company | jakehartson.com | Optional "About Jake" credibility link |
| Search | jakehartson.com | Optional personal bio link (Search-owned decision) |

---

## Quick-reference CSS variables

```css
:root {
  --color-ink: #101412;
  --color-paper: #F3F5F4;
  --color-fog: #E4E9E6;
  --color-stone: #5A635E;
  --color-line: #C9D1CC;
  --color-teal: #0F766E;
  --color-teal-bright: #0D9488;

  --font-display: 'Newsreader Variable', Georgia, serif;
  --font-sans: 'Source Sans 3 Variable', system-ui, sans-serif;

  --content-max-width: 42rem;
  --section-y: clamp(3.5rem, 8vw, 6rem);
}
```
