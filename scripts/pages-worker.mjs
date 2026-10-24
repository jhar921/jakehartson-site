// Bundle dist/ into a single Cloudflare Pages _worker.js (advanced mode).
// Usage: node scripts/pages-worker.mjs dist [--label preview-name] [--out _worker.js]
//
// The worker mimics Pages static serving, plus:
// - www.jakehartson.com -> https://jakehartson.com (301, path and query kept)
// - /card -> /card/ (301)
// - unknown paths -> /404.html with status 404
// - POST /api/contact -> CONTACT service binding (jakehartson-contact Worker)
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const args = process.argv.slice(2);
const dist = args[0] ?? 'dist';
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};
const label = flag('--label') ?? '';
const out = flag('--out') ?? '_worker.js';

const files = {};
const walk = (d) => {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) walk(p);
    else files['/' + relative(dist, p)] = readFileSync(p).toString('base64');
  }
};
walk(dist);
const headersFile = files['/_headers'] ? Buffer.from(files['/_headers'], 'base64').toString() : '';
delete files['/_headers'];

const worker = `
const FILES = ${JSON.stringify(files)};
const HEADERS_FILE = ${JSON.stringify(headersFile)};
const LABEL = ${JSON.stringify(label)};
const APEX = 'jakehartson.com';
const TYPES = { html:'text/html; charset=utf-8', css:'text/css; charset=utf-8', js:'application/javascript', json:'application/json', xml:'application/xml', txt:'text/plain; charset=utf-8', webp:'image/webp', avif:'image/avif', png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', svg:'image/svg+xml', ico:'image/x-icon', woff2:'font/woff2', webmanifest:'application/manifest+json', vcf:'text/vcard' };
const RULES = []; { let cur = null; for (const line of HEADERS_FILE.split('\\n')) { if (!line.trim()) continue; if (!/^\\s/.test(line)) { cur = { path: line.trim(), headers: [] }; RULES.push(cur); } else if (cur) { const i = line.indexOf(':'); cur.headers.push([line.slice(0, i).trim(), line.slice(i + 1).trim()]); } } }
const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const redirect = (to, status) => new Response(null, { status, headers: { location: to } });
const json = (body, status) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
function serve(path, status) {
  const ext = path.split('.').pop();
  const h = new Headers({ 'content-type': TYPES[ext] || 'application/octet-stream' });
  if (LABEL) h.set('x-preview-bundle', LABEL);
  h.set('cache-control', path.startsWith('/_astro/') ? 'public, max-age=31536000, immutable' : 'public, max-age=0, must-revalidate');
  for (const r of RULES) if (r.path === path) for (const [k, v] of r.headers) h.set(k, v);
  return new Response(b64(FILES[path]), { status, headers: h });
}
export default { async fetch(req, env) {
  const url = new URL(req.url);
  if (url.hostname === 'www.' + APEX) return redirect('https://' + APEX + url.pathname + url.search, 301);
  let p;
  try { p = decodeURIComponent(url.pathname); } catch { return serve('/404.html', 404); }
  if (p === '/api/contact') {
    if (req.method !== 'POST') return json({ ok: false, error: 'method' }, 405);
    if (!env || !env.CONTACT) return json({ ok: false, error: 'unavailable' }, 503);
    return env.CONTACT.fetch(req);
  }
  if (p.endsWith('/index.html')) return redirect(p.slice(0, -10) + url.search, 308);
  if (p.endsWith('.html') && FILES[p]) return redirect(p.slice(0, -5) + url.search, 308);
  if (FILES[p] && !p.endsWith('.html')) return serve(p, 200);
  if (p.endsWith('/') && FILES[p + 'index.html']) return serve(p + 'index.html', 200);
  if (!p.endsWith('/') && FILES[p + '/index.html']) return redirect(p + '/' + url.search, 301);
  if (!p.endsWith('/') && FILES[p + '.html'] && p !== '/404') return serve(p + '.html', 200);
  return serve('/404.html', 404);
} };
`;
writeFileSync(out, worker);
console.log('files', Object.keys(files).length, 'worker bytes', worker.length);
