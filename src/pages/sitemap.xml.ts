import type { APIRoute } from 'astro';

// Only real, indexable pages. Paths match how Cloudflare Pages serves them
// (directory pages end in a slash). Add a page here when one is added to src/pages.
const PAGES = ['/', '/card/'];

export const GET: APIRoute = ({ site }) => {
  const urls = PAGES.map((path) => `  <url>\n    <loc>${new URL(path, site).href}</loc>\n  </url>`).join('\n');
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
