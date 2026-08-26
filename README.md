# jakehartson.com

Personal marketplace portfolio for Jake Hartson: founder and strategist credibility. Astro 6 + Tailwind 4. Deploys to Vercel from `main`.

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

Vercel auto-deploys on push to `main`.

- Project: `jakehartson-site` on team `jakeh`
- Build command: `npm run build`
- Output directory: `dist`
- Custom domain: `jakehartson.com`
- Redirects and headers: `vercel.json` (www → apex, vCard content type)

## Reference Pack workflow

Content and design decisions live in Notion. When copy or assets change:

1. Update the Content Blueprint or Site Assets page in Notion.
2. Bump the Reference Pack version.
3. Run the RP in Claude Code (paste the Hand-off Footer).
4. Claude Code reads the RP, makes changes, pushes to `main`.
5. Vercel deploys automatically.
6. Claude Code updates the RP row in Notion (Status, Run Count, Last Run, Last Outcome) and appends a Post-Build Log to the RP page.

## Docs

- `/brand/BRAND.md`: personal marketplace brand system
- `/docs/RP-current.md`: most recent Reference Pack body
- `/docs/archive/`: archived RP versions
