# jakehartson.com

Personal marketplace portfolio for Jake Hartson: founder and strategist credibility. Astro 6 + Tailwind 4. Deploys to Netlify from `main`.

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

Netlify auto-deploys on push to `main`.

- Build command: `npm run build`
- Publish directory: `dist`
- Custom domain: `jakehartson.com`

## Docs

- `/brand/BRAND.md`: personal marketplace brand system
- `/docs/RP-current.md`: most recent Reference Pack body
- `/docs/archive/`: archived RP versions
