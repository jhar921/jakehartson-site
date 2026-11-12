/**
 * Access checks for /api/*.
 *
 * Production verifies the Cloudflare Access JWT (aud + iss from env, signature
 * against the team JWKS) as defense in depth. Access still sits in front.
 *
 * LIFTS_DEV_BYPASS_ACCESS=1 skips the check only when ACCESS_AUD,
 * ACCESS_TEAM_DOMAIN, and ACCESS_SERVICE_AUD are all unset. That flag is
 * absent from wrangler.toml, so a production deploy that sets the Access env
 * vars cannot enable the bypass even if the flag is added later.
 */

const jwksCache = new Map();

export function canBypassAccess(env) {
  return (
    env?.LIFTS_DEV_BYPASS_ACCESS === "1" &&
    !env.ACCESS_AUD &&
    !env.ACCESS_TEAM_DOMAIN &&
    !env.ACCESS_SERVICE_AUD
  );
}

function b64urlToBytes(s) {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const b64 = (s + pad).replaceAll("-", "+").replaceAll("_", "/");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function parsePart(part) {
  return JSON.parse(new TextDecoder().decode(b64urlToBytes(part)));
}

async function getJwks(teamDomain) {
  const now = Date.now();
  const hit = jwksCache.get(teamDomain);
  if (hit && hit.expiresAt > now) return hit.keys;
  const url = `https://${teamDomain}/cdn-cgi/access/certs`;
  const res = await fetch(url, { cf: { cacheTtl: 3600, cacheEverything: true } });
  if (!res.ok) throw new Error("jwks fetch failed");
  const body = await res.json();
  if (!body || !Array.isArray(body.keys)) throw new Error("jwks shape");
  jwksCache.set(teamDomain, { keys: body.keys, expiresAt: now + 60 * 60 * 1000 });
  return body.keys;
}

export async function verifyAccessJwt(token, env) {
  if (typeof token !== "string" || token.split(".").length !== 3) {
    throw new Error("jwt shape");
  }
  const [h, p, sig] = token.split(".");
  const header = parsePart(h);
  const payload = parsePart(p);
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp < now) throw new Error("expired");
  const allowed = [env.ACCESS_AUD, env.ACCESS_SERVICE_AUD].filter(Boolean);
  if (!allowed.length) throw new Error("aud not configured");
  const tokenAud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!tokenAud.some((a) => allowed.includes(a))) throw new Error("aud");
  const teamDomain = env.ACCESS_TEAM_DOMAIN;
  if (!teamDomain) throw new Error("iss not configured");
  if (payload.iss !== `https://${teamDomain}`) throw new Error("iss");
  if (header.alg !== "RS256") throw new Error("alg");
  const keys = await getJwks(teamDomain);
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) throw new Error("kid");
  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const ok = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    b64urlToBytes(sig),
    new TextEncoder().encode(`${h}.${p}`),
  );
  if (!ok) throw new Error("sig");
  return payload;
}

export async function requireAccess(request, env) {
  if (canBypassAccess(env)) return { ok: true, dev: true };
  const jwt = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!jwt) return { ok: false, status: 401, message: "Access required" };
  try {
    const claims = await verifyAccessJwt(jwt, env);
    return { ok: true, claims };
  } catch {
    return { ok: false, status: 403, message: "Access denied" };
  }
}
