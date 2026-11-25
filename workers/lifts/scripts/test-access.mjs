/**
 * Access sign-in helper checks (no browser).
 * Run: node scripts/test-access.mjs
 */
import { accessLoginUrl, isAccessBlocked, isAccessError } from "../public/lifts-access.js";

let passed = 0;
function assert(cond, msg) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  passed++;
}

assert(isAccessBlocked({ status: 401 }) === true, "401 is Access blocked");
assert(isAccessBlocked({ status: 403 }) === true, "403 is Access blocked");
assert(isAccessBlocked({ status: 302 }) === true, "302 is Access blocked");
assert(isAccessBlocked({ status: 0, type: "opaqueredirect" }) === true, "opaqueredirect is Access blocked");
assert(isAccessBlocked({ status: 200 }) === false, "200 is not Access blocked");
assert(isAccessBlocked({ status: 500 }) === false, "500 is not Access blocked");
assert(isAccessBlocked(null) === false, "null is not Access blocked");

assert(isAccessError({ access: true, status: 401 }) === true, "flagged error is Access");
assert(isAccessError({ status: 401 }) === true, "401 error is Access");
assert(isAccessError({ status: 403 }) === true, "403 error is Access");
assert(isAccessError({ message: "Failed to fetch" }) === false, "plain TypeError is not classified as Access");

const href = accessLoginUrl({ origin: "https://lifts.jakehartson.com", host: "lifts.jakehartson.com" });
const url = new URL(href);
assert(url.origin === "https://lifts.jakehartson.com", "login URL stays on the app origin");
assert(url.pathname === "/cdn-cgi/access/login/lifts.jakehartson.com", "login path uses the app host");
assert(url.searchParams.get("redirect_url") === "https://lifts.jakehartson.com/", "redirect_url returns to the app root");

console.log(`ok: ${passed} access sign-in checks passed`);
