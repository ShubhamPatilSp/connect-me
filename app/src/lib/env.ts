/**
 * Environment helpers.
 *
 * Demo-only affordances (one-tap login, self-serve upgrade) must never be
 * reachable on a public deployment by accident. They are on for localhost and
 * development, and require an explicit opt-in anywhere else.
 */

const LOCAL_HOSTS = /^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)(:\d+)?$/;

/**
 * RFC 1918 addresses. A phone on the same Wi-Fi reaches the dev server over one
 * of these, and it is still a private network — never a public deployment.
 */
const PRIVATE_HOST =
  /^(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?$/;

export function demoFeaturesEnabled(req: Request): boolean {
  const flag = process.env.CONNEXA_DEMO_LOGIN;
  if (flag === "0") return false;
  if (flag === "1") return true;
  if (process.env.NODE_ENV !== "production") return true;

  const host = (req.headers.get("host") ?? "").toLowerCase();
  return LOCAL_HOSTS.test(host) || PRIVATE_HOST.test(host);
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}
