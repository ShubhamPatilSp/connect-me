# Connect Me — a dating app for Khandesh

A working, production-shaped dating app scoped to the Khandesh region of Maharashtra
(Jalgaon, Dhule, Nandurbar). Dark, gradient-led interface modelled on the reference
design: full-bleed swipe cards, match percentage, floating action bar, four-tab shell.

Not a mockup — every screen talks to a real database, real auth, real matching, and
real-time chat.

```
dating/
├─ app/                     the application (Next.js + TypeScript)
│  ├─ src/app/              routes: marketing, onboarding, (app) shell, 18 API routes
│  ├─ src/lib/              db, auth, matching engine, geo registry, seed
│  ├─ src/components/       deck, overlays, media, shell, icons
│  ├─ scripts/              smoke test, screenshot harness
│  └─ data/connexa.db       SQLite (created on first run, gitignored)
└─ docs/architecture/       tech-stack decision record
```

## Run it

```bash
cd app
npm install
npm run dev          # http://localhost:3000
```

First request creates and seeds the database: 36 Khandesh profiles, a demo account,
six inbound likes, three live conversations.

**Two ways in:**

- **Explore the demo account** — one click on the landing page. Signs you in as Rohan,
  a 27-year-old in Jalgaon, with matches and unread messages already waiting.
- **Sign up properly** — enter any valid Indian mobile number. The 6-digit OTP is shown
  on screen because no SMS gateway is wired up; everything after that is real.

Production build:

```bash
npm run build && npm start
```

## Android APK

The installable build lives at **`mobile/android/app/build/outputs/apk/debug/app-debug.apk`**.

```bash
adb install -r mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

The APK is a native shell (one Activity, no third-party libraries) around the web
client. Connect Me is server-rendered — auth, matching and chat are all `/api/*` calls —
so the phone needs to reach a running backend. On first launch the app asks for the
address; enter your computer's LAN IP:

```bash
cd app && npm start          # binds 0.0.0.0:3000
ipconfig                     # find IPv4, e.g. 192.168.1.42
# in the app: http://192.168.1.42:3000
```

The phone and the computer must be on the same Wi-Fi. The address is remembered.

What the shell fixes that a plain WebView gets wrong: hardware back walks history
instead of closing the app, `<input type="file">` opens the system photo picker
(multi-select), cleartext HTTP is allowed for a LAN server with no certificate,
and an unreachable server drops to the setup screen rather than a browser error page.

Rebuild with:

```bash
cd mobile/android && gradle assembleDebug
```

Details and release signing in [`mobile/README.md`](mobile/README.md).

## What is actually implemented

| Area | Detail |
|---|---|
| Auth | Phone OTP (HMAC-hashed, 5-minute TTL, 5 attempts, 30s resend cooldown, 5/hour cap) + opaque 256-bit sessions stored as SHA-256 digests in httpOnly cookies |
| Onboarding | 7 steps: phone → OTP → identity → Khandesh city → photos (real upload, client-resized to 760px) → interests → intent + bio |
| Discovery | Precomputed candidate queue, seven-signal compatibility score, diversity cap, epsilon-greedy exploration |
| Swiping | Pointer-driven deck with velocity-free threshold gestures, stamps, button parity, optimistic removal with rollback |
| Matching | Atomic reciprocal-like detection inside a single write transaction, canonical pair ordering, unique constraint |
| Chat | SSE stream with heartbeat + watchdog, optimistic send, read receipts, unread counts, unmatch, report |
| Gating | 25 likes/day free, 1 super like/day, blurred inbound likes for free tier, verification-only filter |
| Safety | Block, report with reason taxonomy, automatic shadow-ban at 5 open reports, region lock on every query |
| Settings | Age range, distance, verified-only, plan switch, session logout |

## The matching engine

The naive design — run a filtered geo-query on every swipe — is what kills dating apps.
This one is two-phase.

**Phase 1 (offline, `rebuildQueue`).** Every eligible candidate is scored and written to
`candidate_queue` as ~240 ranked rows per viewer. Runs when the queue is empty or older
than six hours.

**Phase 2 (online, `getDeck`).** An indexed read of the next N rows. A swipe costs one
insert and one reciprocal lookup.

Hard filters are applied in SQL: mutual gender preference, not already swiped, no block
in either direction, onboarding complete, not shadow-banned, inside the viewer's radius
and age band.

Soft signals, weighted:

| Signal | Weight | How it is computed |
|---|---|---|
| Shared interests | 0.32 | Cosine similarity over binary interest vectors, each tag weighted by IDF so `Trekking` counts more than `Music` |
| Distance | 0.22 | `exp(-km / 22)` — a soft decay, not a cliff |
| Activity recency | 0.13 | `exp(-hours_idle / 96)` |
| Intent alignment | 0.10 | serious↔serious 1.0, serious↔casual 0.3 |
| Age proximity | 0.08 | `1 - min(1, |Δage| / 12)` |
| Profile completeness | 0.08 | photos, bio length, prompts, interest count |
| Photo verification | 0.07 | binary |

Then a diversity pass caps any single city at ~18% of the queue, and ~12% of slots are
reserved for candidates outside the top slice (epsilon-greedy) so the deck does not
collapse into a filter bubble. Each card explains itself — "3 shared interests",
"2 km away", "Same intentions" — because a score nobody can read is a score nobody trusts.

## Khandesh-only, enforced in four places

1. `lib/geo.ts` is the single source of truth: 28 towns across three districts with
   coordinates, Marathi names, and district mapping.
2. Onboarding rejects any city outside the registry and snaps GPS to the nearest town.
3. Every discovery query is bounded by the viewer's radius inside that registry.
4. Region cannot be changed to anywhere else — the picker only offers Khandesh towns.

## API

| Route | Purpose |
|---|---|
| `POST /api/auth/request-otp` · `verify` · `logout` · `demo` | Session lifecycle |
| `GET/PATCH /api/me` | Profile, stats, preferences, photos, interests |
| `POST /api/onboarding` | Complete signup, rebuild queue |
| `GET /api/deck` | Ranked cards with score + reasons |
| `POST /api/swipe` | pass / like / super, returns match if reciprocal |
| `GET /api/likes` | Inbound likes (blurred when free) |
| `GET /api/matches` | Threads with last message and unread count |
| `GET/POST /api/messages/[matchId]` | History + send |
| `GET /api/stream` | SSE: match, message, read |
| `GET /api/profile/[userId]` | Profile + relationship state |
| `POST /api/block` · `/api/report` | Safety actions |
| `POST /api/matches/[matchId]/unmatch` | End a match |

## Verify it

```bash
npm start                       # in one terminal
node scripts/smoke.mjs          # in another — 21 assertions across the critical path
```

The smoke test covers auth, deck integrity, scoring bounds, match creation, duplicate
swipe rejection, messaging, paywall gating, unmatch, and unauthenticated access.

## Deliberate demo affordances

Two things are switched on only for localhost / `NODE_ENV=development` and must not ship:

- `POST /api/auth/demo` — one-tap session for the seeded account.
- `POST /api/premium` — flips the subscription flag so the paywall is testable.

Both check `demoFeaturesEnabled()` in `lib/env.ts`, which returns false on a public host
unless `CONNEXA_DEMO_LOGIN=1` is explicitly set. Real entitlements belong in an App
Store / Play receipt webhook.

The OTP is also surfaced in the response for the same reason — replace `requestOtp` with
an SMS provider call and the field disappears.

## Known limits (and where they break)

- **SQLite** is the right call for a single-region app of this size and keeps deployment
  free. The schema is Postgres-portable; swap the driver and `getBuiltinModule` call in
  `lib/db.ts` when you outgrow one box. Everything else stays.
- **SSE** fans out through an in-process EventEmitter. Multi-instance deployments need
  Redis pub/sub — `lib/bus.ts` is the only file that changes.
- **Rate limiting** is in-process token buckets. Same story: move to Redis.
- **Seed portraits** are stock photographs of Indian men and women from Pexels (free for
  commercial use, no attribution required), downloaded into `public/seed/` by
  `scripts/fetch-seed-photos.mjs`. They are demo placeholders — real users upload their
  own photos, resized to 760px on the client.
- **Moderation** is report-count based. A real launch needs photo verification against a
  face-matching service and a human review queue.

## Design notes

Colour, type, and spacing live in `src/app/globals.css` as tokens; component layout lives
in `src/app/ui.css`. No CSS framework — the reference design is bespoke, and utility
classes would have fought it.

The deck's gesture layer is hand-written on pointer events rather than a library: it needs
precise control over the drag threshold, the spring-back, and the programmatic exit that
the action buttons trigger, and it has to feel identical on touch and mouse.
