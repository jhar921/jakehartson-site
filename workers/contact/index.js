// jakehartson-contact: receives the jakehartson.com contact form (via the
// Pages CONTACT service binding), checks Turnstile, and emails Jake.
//
// Bindings (set at upload, see docs/cloudflare.md):
//   EMAIL             send_email, destination_address jake@jakehartson.com
//   TURNSTILE_SECRET  secret_text
//   FROM_ADDRESS      plain_text, sender on a domain with Email Routing enabled

const TO = 'jake@jakehartson.com';
const ALLOWED_HOSTS = (h) => h === 'jakehartson.com' || h === 'jakehartson-site.pages.dev' || h.endsWith('.jakehartson-site.pages.dev');
const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

const clean = (v, max) => String(v ?? '').replace(/\r\n?/g, '\n').trim().slice(0, max);
const oneLine = (v) => v.replace(/[\r\n]+/g, ' ');

export default {
  async fetch(req, env) {
    if (req.method !== 'POST') return json({ ok: false, error: 'method' }, 405);

    let form;
    try {
      form = await req.formData();
    } catch {
      return json({ ok: false, error: 'bad_request' }, 400);
    }

    const name = oneLine(clean(form.get('name'), 120));
    const email = oneLine(clean(form.get('email'), 254));
    const message = clean(form.get('message'), 5000);
    const token = clean(form.get('cf-turnstile-response'), 4096);

    // Honeypot: bots fill the hidden field. Pretend success, send nothing.
    if (clean(form.get('website'), 200)) return json({ ok: true });

    if (!name || !message || !EMAIL_RE.test(email)) return json({ ok: false, error: 'invalid' }, 400);
    if (!token) return json({ ok: false, error: 'turnstile' }, 400);

    const verify = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: new URLSearchParams({
        secret: env.TURNSTILE_SECRET,
        response: token,
        remoteip: req.headers.get('cf-connecting-ip') ?? '',
      }),
    }).then((r) => r.json()).catch(() => ({ success: false }));
    if (!verify.success || !ALLOWED_HOSTS(String(verify.hostname ?? ''))) {
      return json({ ok: false, error: 'turnstile' }, 403);
    }

    const text = `Name: ${name}\nEmail: ${email}\nFrom: https://${verify.hostname}/\n\n${message}\n`;
    try {
      await env.EMAIL.send({
        from: { email: env.FROM_ADDRESS, name: 'jakehartson.com' },
        to: TO,
        replyTo: { email, name },
        subject: `Website message from ${name}`,
        text,
      });
    } catch (e) {
      console.error('send failed', e && (e.code || e.message));
      return json({ ok: false, error: 'send' }, 502);
    }
    return json({ ok: true });
  },
};
