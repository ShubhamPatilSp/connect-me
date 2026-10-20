# Tech Stack Decision — Dating App

**Status:** decided
**Date:** 2026-10-20
**Constraint set:** one stack, no Flutter, free-tier first, must scale without a rewrite.

---

## The decision

**React Native + Expo (TypeScript) on the client, Supabase (Postgres) as the backend, Cloudflare R2 for media.**

That is the whole stack. Everything else is a bolt-on that can be swapped without touching the core.

| Layer | Choice | Why this one | Free tier |
|---|---|---|---|
| Mobile client | React Native + Expo SDK, TypeScript | One codebase, iOS + Android, real native gestures for the swipe deck, OTA updates without store review | Free |
| Navigation | Expo Router (file-based) | Routes map 1:1 to the 35-screen inventory | Free |
| Server state | TanStack Query | Caching, retries, optimistic swipe/like updates | Free |
| Local state | Zustand | Tiny, no boilerplate | Free |
| Gestures | Reanimated + Gesture Handler | 60fps swipe cards on the UI thread | Free |
| Database | Postgres 15 + PostGIS (via Supabase) | Relational fits matches/messages/blocks; PostGIS gives real distance queries | 500 MB |
| Auth | Supabase Auth — phone OTP + Apple/Google | OTP is the dating-app default; social login lifts conversion | 50k MAU |
| Authorization | Postgres Row Level Security | Access rules live next to the data — a user can only read their own matches/messages | Free |
| Realtime | Supabase Realtime | Chat + match notifications over Postgres logical replication, no separate service | 200 concurrent, 2M msgs/mo |
| Server logic | Supabase Edge Functions (Deno/TS) | Match detection, push fanout, moderation hooks — no server to run | 500k invocations |
| Scheduled jobs | pg_cron | Nightly candidate-queue rebuild | Free |
| Media storage | Cloudflare R2 | S3-compatible, **zero egress** — photos are the #1 cost in a dating app | 10 GB, 1M writes, 10M reads |
| Image delivery | Cloudflare CDN + Workers image transforms | 3 derivative sizes per upload, served from edge | Free tier |
| Push | Expo Notifications → APNs/FCM | One API for both platforms | Free |
| Cache / rate limit | Upstash Redis | Daily like counters, OTP throttling, presence | ~10k cmds/day |
| Analytics | PostHog | Funnels: signup → first swipe → first match → first message | ~1M events/mo |
| Errors | Sentry | RN crash + release health | ~5k errors/mo |
| CI | GitHub Actions | Typecheck, lint, test on PR | 2,000 min/mo private |
| Builds | EAS Build | Cloud iOS/Android builds, no Mac needed | 15 Android + 15 iOS builds/mo |
| OTA updates | EAS Update | Ship JS fixes without store review | 1,000 MAU |
| Payments | RevenueCat + native IAP | App Store rules require IAP for subscriptions; RevenueCat handles receipts/restore | Free under ~$2.5k MTR |
| Admin / moderation | Next.js on Vercel + Supabase service role | Report queue, photo review, user lookup | Free |

**Language count: one.** TypeScript end to end — client, edge functions, admin. No context switching, shared validation types in `packages/shared`.

---

## Why not the alternatives

| Rejected | Reason |
|---|---|
| Flutter | Excluded by requirement. (Also: no OTA JS updates, weaker TS type sharing with the backend.) |
| Native Swift + Kotlin | Best performance, but two codebases, two teams, twice the time to 35 screens. Revisit only if the swipe deck becomes a competitive differentiator at scale. |
| Next.js PWA only | iOS limits web push and background location; no App Store presence. Dating apps are discovered in stores. |
| Firebase / Firestore | Geo queries need geohash hacks, no joins for blocks/matches, and per-read pricing makes chat expensive at exactly the moment you succeed. |
| Ionic / Capacitor | WebView kills swipe gesture fidelity — the one interaction the product lives on. |
| Custom Node/Express + raw Postgres on a VPS | You'd rebuild auth, realtime, storage, and RLS yourself. Weeks of undifferentiated work, and it's *less* scalable than managed Postgres until you have a platform team. |

---

## What "free" actually covers

| Resource | Free limit | Real-world meaning |
|---|---|---|
| Supabase DB | 500 MB | ~50k profiles + ~1M messages |
| Supabase storage | 1 GB | Don't use it — photos go to R2 |
| Supabase egress | 5 GB/mo | Fine, because media bypasses Supabase entirely |
| Realtime connections | 200 concurrent | **The first real ceiling** — roughly 5–10k DAU with chat open |
| R2 storage | 10 GB | ~200k compressed photos at 50 KB each |
| R2 egress | **$0, always** | This is why photos don't bankrupt you |
| EAS builds | 15 + 15 per month | Enough for solo dev; a team will hit this |
| EAS Update | 1,000 MAU | Enough until launch traction |

**The honest boundary:** the free tier is genuinely viable to *launch*. It stops being free at two points — (1) Supabase pauses free projects after 7 days of inactivity, so production needs Pro at **$25/mo**; (2) 200 realtime connections, which you'll hit somewhere around 5–10k DAU. Budget **$25–50/mo** as the first real bill, and nothing else until well past 10k users.

---

## The five hard problems, and how this stack solves them

**1. The swipe deck must never query live.** Running a filtered geo-query per swipe is the classic dating-app death spiral. Instead, `pg_cron` rebuilds a per-user candidate queue nightly (`candidate_queue`: user_id, candidate_id, score, expires_at, ~200 rows each), and the deck reads one row per swipe — O(1), no joins on the hot path. This is the single most important scalability decision in the whole design.

**2. Match detection must be atomic.** A `swipes` table with `unique(swiper_id, target_id)`, partitioned by month. On insert, a trigger checks for the reciprocal like in the same transaction and writes a `matches` row. No race conditions, no double matches, no eventual-consistency bug where two people both "match" and neither sees it.

**3. Chat is read-heavy.** Messages partitioned by month, Realtime subscribed per-match channel, RLS so a user can only join channels for their own matches. 200 concurrent connections is the ceiling — that's the signal to migrate chat to a dedicated service (Centrifugo self-hosted, or Stream/Aably), not before.

**4. Photos are the biggest bandwidth line item.** Upload once, generate three derivatives (200 / 800 / 1600 px), serve from Cloudflare's edge. R2's zero egress means a viral moment costs you storage, not bandwidth.

**5. Safety is a schema problem, not a UI problem.** `blocks` must be joined into every discovery and chat query — not filtered in the client. `reports` needs an append-only audit trail. Add `shadow_banned` on profiles from day one so moderation can act without tipping off bad actors.

---

## Scaling path

| Stage | Users | Change | Cost |
|---|---|---|---|
| 0 — Build | 0–2k | Everything free, Supabase free project | $0 |
| 1 — Launch | 2k–10k | Supabase Pro, R2 + CDN, keepalive removed | ~$25–50/mo |
| 2 — Growth | 10k–100k | Move chat off Realtime to dedicated WS service; read replica for discovery; partition `messages` by month; async moderation workers on Fly.io | ~$150–400/mo |
| 3 — Scale | 100k+ | Shard by region, separate match/swipe service, event pipeline for analytics, CDN image resizing at edge | Usage-based |

Nothing in stage 2 or 3 requires rewriting the client. That's the point of choosing plain Postgres over a proprietary backend.

---

## Repo structure

```
dating/
├─ apps/
│  ├─ mobile/            Expo app — 35 screens, Expo Router
│  └─ admin/             Next.js moderation console
├─ packages/
│  ├─ shared/            Types, Zod schemas, constants
│  └─ ui/                Design tokens, shared components
└─ supabase/
   ├─ migrations/        SQL schema, RLS policies, triggers
   └─ functions/         Edge functions (match, push, moderation)
```

---

## Risks to validate before building

1. **Expo Go can't run custom native modules.** You'll need dev builds (`expo-dev-client`) as soon as you add IAP or advanced camera. Plan for it in week 1, not week 8.
2. **Supabase free projects pause after 7 days idle.** Set a keepalive cron or you'll find a dead backend on demo day.
3. **Photo verification needs real moderation.** Client-side face detection plus manual review works to a few hundred reports/day; beyond that, budget for AWS Rekognition or similar.
4. **Vendor lock-in is low but not zero.** Data is plain Postgres (portable); Auth and Realtime are the sticky parts. Keep auth logic behind an interface in `packages/shared`.
5. **App Store review for dating apps is strict.** Age gating, report/block, and account deletion are mandatory — they're already in the 35-screen inventory, which is why 28 and 31 exist.
