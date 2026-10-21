/**
 * End-to-end smoke test against a running server.
 *
 *   node scripts/smoke.mjs [baseUrl]
 *
 * Checks public entry points and that protected APIs require a real account.
 * Exits non-zero on any failure.
 */

const BASE = process.argv[2] ?? "http://127.0.0.1:3100";

let cookie = "";
let passed = 0;
let failed = 0;

function check(name, condition, detail = "") {
  if (condition) {
    passed++;
    console.log(`  ok   ${name}`);
  } else {
    failed++;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function call(path, { method = "GET", body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(cookie ? { cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  if (setCookie.length > 0) {
    cookie = setCookie.map((c) => c.split(";")[0]).join("; ");
  }
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

console.log(`\nConnexa smoke test → ${BASE}\n`);

const health = await call("/");
check("landing page responds", health.status === 200);

const demoLogin = await fetch(`${BASE}/api/auth/demo`, { method: "POST" });
check("demo login endpoint is removed", demoLogin.status === 404);

const [me, deck, matches] = await Promise.all([
  fetch(`${BASE}/api/me`),
  fetch(`${BASE}/api/deck`),
  fetch(`${BASE}/api/matches`),
]);
check("profile requires an authenticated user", me.status === 401);
check("discovery requires an authenticated user", deck.status === 401);
check("matches require an authenticated user", matches.status === 401);

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exitCode = failed === 0 ? 0 : 1;
