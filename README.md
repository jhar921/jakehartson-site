# jakehartson.com

Personal marketplace portfolio for Jake Hartson: founder and strategist credibility. Astro 6 + Tailwind 4. Hosted on Cloudflare Pages.

## Brand separation

| Property | Role |
|---|---|
| **jakehartson.com** | Marketplace personal trust layer (this repo) |
| **Search / Search OC** | Ministry / Christian audience |
| **The Clarity Company** | Generic business education |

No ministry copy or Search CTAs on this site. See `brand/BRAND.md`.

## Stack

- Astro 6.x (static output)
- Tailwind CSS 4.x (theme in `src/styles/global.css`)
- Fontsource: Newsreader Variable (display) + Source Sans 3 Variable (body)
- Sharp for image optimization (AVIF/WebP via Astro `<Image>`)

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

Output goes to `dist/`.

## Deploy

Cloudflare Pages, project `jakehartson-site`, by direct upload (not Git-connected).

- Build command: `npm run build` (output in `dist/`)
- Bundle: `node scripts/pages-worker.mjs dist` writes `_worker.js`, which serves every file in `dist/`, applies `public/_headers`, returns `/404.html` with status 404, 301s `/card` to `/card/`, and 301s `www.jakehartson.com` to the apex
- Upload `_worker.js` as a Pages deployment. Branch `main` is production; any other branch name gives a preview at `https://<branch>.jakehartson-site.pages.dev`
- Custom domains: `jakehartson.com` and `www.jakehartson.com` (the zone also has a Redirect Rule for www, see `docs/cloudflare.md`)
- Contact form: `POST /api/contact` goes through the `CONTACT` service binding to the `jakehartson-contact` Worker (`workers/contact/`), which checks Turnstile and emails jake@jakehartson.com
- `vercel.json` is left over from the old host and is not read by anything

## Reference Pack workflow

Content and design decisions live in Notion. When copy or assets change:

1. Update the Content Blueprint or Site Assets page in Notion.
2. Bump the Reference Pack version.
3. Run the RP in Claude Code (paste the Hand-off Footer).
4. Claude Code reads the RP, makes changes, pushes to `main`.
5. Build and upload the bundle to Cloudflare Pages (see Deploy).
6. Claude Code updates the RP row in Notion (Status, Run Count, Last Run, Last Outcome) and appends a Post-Build Log to the RP page.

## Docs

- `/brand/BRAND.md`: personal marketplace brand system
- `/docs/RP-current.md`: most recent Reference Pack body
- `/docs/archive/`: archived RP versions
