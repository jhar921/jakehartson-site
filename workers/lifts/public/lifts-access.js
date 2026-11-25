/**
 * Detect Cloudflare Access blocks and build a same-origin login URL.
 * Top-level navigation to this URL can complete the login; fetch cannot.
 */
export function isAccessBlocked(res) {
  if (!res) return false;
  if (res.type === "opaqueredirect") return true;
  const status = res.status;
  if (status === 401 || status === 403) return true;
  if (status >= 300 && status < 400) return true;
  return false;
}

export function isAccessError(err) {
  if (!err) return false;
  if (err.access) return true;
  return err.status === 401 || err.status === 403;
}

/** Same-origin Access login that returns to the app after sign-in. */
export function accessLoginUrl(loc = globalThis.location) {
  const origin = loc.origin;
  const host = loc.host;
  const login = new URL(`/cdn-cgi/access/login/${host}`, origin);
  login.searchParams.set("redirect_url", `${origin}/`);
  return login.href;
}
