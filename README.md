# jakehartson.com

Personal landing site for Jake Hartson. One page. Astro 6 + Tailwind 4. Deploys to Vercel from `main`.

## Stack

- Astro 6.x (static output)
- Tailwind CSS 4.x (CSS-based theme config in `src/styles/global.css`)
- Fontsource: Fraunces Variable (serif headings) + Inter Variable (sans body)
- Sharp for image optimization (auto AVIF/WebP via Astro `<Image>`)

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

- Build command: `npm run build`
- Publish directory: `dist`
- Custom domain: `jakehartson.com`

## Reference Pack workflow

Content and design decisions live in Notion. When copy or assets change:

1. Update the Content Blueprint or Site Assets page in Notion.
2. Bump the Reference Pack version.
3. Run the RP in Claude Code (paste the Hand-off Footer).
4. Claude Code reads the RP, makes changes, pushes to `main`.
5. Vercel deploys automatically.
6. Claude Code updates the RP row in Notion (Status, Run Count, Last Run, Last Outcome) and appends a Post-Build Log to the RP page.

## Docs

- `/docs/RP-current.md`: most recent Reference Pack body
- `/docs/archive/`: archived RP versions
