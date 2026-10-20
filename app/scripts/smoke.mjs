/**
 * End-to-end smoke test against a running server.
 *
 *   node scripts/smoke.mjs [baseUrl]
 *
 * Exercises the full critical path: demo auth → deck → swipe → match →
 * message → likes → premium gating → unmatch. Exits non-zero on any failure.
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

const demo = await call("/api/auth/demo", { method: "POST" });
check("demo login issues a session", demo.status === 200 && demo.json?.ok === true);

const me = await call("/api/me");
check("session resolves the current user", me.status === 200 && Boolean(me.json?.user?.id));

const deck = await call("/api/deck?limit=6");
check("deck returns cards", deck.status === 200 && deck.json.cards.length > 0, `got ${deck.json?.cards?.length}`);
check("cards are scored 0..1", deck.json.cards.every((c) => c.score >= 0 && c.score <= 1));
check("cards are inside Khandesh", deck.json.cards.every((c) => c.cityName !== "Khandesh"));
check("every card explains itself", deck.json.cards.every((c) => Array.isArray(c.reasons)));

const target = deck.json.cards.find((c) => c.likesYou) ?? deck.json.cards[0];
const swipe = await call("/api/swipe", { method: "POST", body: { targetId: target.id, action: "like" } });
check("like is accepted", swipe.status === 200);
check("reciprocal like creates a match", swipe.json.matched === true, JSON.stringify(swipe.json).slice(0, 120));

const dup = await call("/api/swipe", { method: "POST", body: { targetId: target.id, action: "like" } });
check("duplicate swipe is rejected", dup.status === 409);

const matchId = swipe.json.matchId;
const send = await call(`/api/messages/${matchId}`, { method: "POST", body: { body: "Smoke test message" } });
check("message sends", send.status === 200 && send.json.message.body === "Smoke test message");

const thread = await call(`/api/messages/${matchId}`);
check("thread returns history", thread.status === 200 && thread.json.messages.length >= 1);

const likes = await call("/api/likes");
check("likes endpoint responds", likes.status === 200 && Array.isArray(likes.json.likes));

const profile = await call(`/api/profile/${target.id}`);
check("profile detail resolves", profile.status === 200 && profile.json.profile.id === target.id);
check("relationship state is exposed", typeof profile.json.relationship.matched === "boolean");

const premiumOff = await call("/api/premium", { method: "POST", body: { enable: false } });
check("premium can be toggled", premiumOff.status === 200);

const locked = await call("/api/likes");
check("free tier blurs inbound likes", locked.json.locked === true && locked.json.likes.every((l) => l.locked));

const premiumOn = await call("/api/premium", { method: "POST", body: { enable: true } });
check("premium restores", premiumOn.status === 200 && premiumOn.json.isPremium === true);

const unmatch = await call(`/api/matches/${matchId}/unmatch`, { method: "POST" });
check("unmatch succeeds", unmatch.status === 200);

const afterUnmatch = await call("/api/matches");
check(
  "unmatched pair disappears from matches",
  afterUnmatch.json.matches.every((m) => m.id !== matchId),
);

const unauth = await fetch(`${BASE}/api/deck`).then((r) => r.status);
check("deck requires auth", unauth === 401);

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
