/**
 * Detect Cloudflare Access blocks and build the Sign in href.
 * A top-level document navigation to the app root lets the browser
 * follow Access's 302 to the team-domain login; fetch cannot.
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

/** App root. Use as an <a href> so login is a full document navigation. */
export function accessLoginUrl(loc = globalThis.location) {
  return new URL("/", loc.origin).href;
}
