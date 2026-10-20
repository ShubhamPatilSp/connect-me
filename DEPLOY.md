# Deploying Connect Me

The APK is a client. It needs a backend that is reachable 24/7 over HTTPS — that is the
only thing standing between the current build and a real app.

## What is already production-shaped

| Piece | Status |
|---|---|
| Auth | Firebase Phone Auth, native, verified server-side against Google's public certs |
| Sessions | 256-bit opaque tokens, SHA-256 at rest, httpOnly cookies, `Secure` only over TLS |
| Data | SQLite (WAL), foreign keys on, indexed |
| Matching | Precomputed queue, seven-signal score |
| Chat | Persisted + SSE, read receipts, unread counts |
| Safety | Blocks, reports, auto shadow-ban |
| Region | Khandesh-only, enforced in four places |

## Deploy to Render

1. Push this repo to GitHub.
2. Render → **New → Blueprint** → pick the repo. It reads `render.yaml`.
3. Apply. First build takes ~4 minutes.
4. Note the URL, e.g. `https://connexa.onrender.com`.
5. In the app's connect screen, enter that URL.

`render.yaml` sets `plan: starter` because a **persistent disk** is required — the free
tier has ephemeral storage, so the database would reset on every deploy and every restart.

### Why not the free tier

| | Free | Starter ($7/mo) |
|---|---|---|
| Disk | ✗ ephemeral | ✓ 1 GB |
| Sleeps when idle | ✓ ~50s cold start | ✗ always on |
| Custom domain | ✓ | ✓ |

For a real product the $7 tier is the minimum. If you want zero cost, the alternative is
swapping SQLite for Postgres (Neon/Supabase free) — that is a real refactor of every
query, roughly a day of work.

## After deploying

1. **Rebuild the APK with the production URL baked in** so there is no connect screen.
   In `MainActivity`, default `KEY_SERVER` to the deployed URL.
2. **Turn on Firebase App Check** (Play Integrity) once the app is in Play internal
   testing — this stops anyone calling your auth endpoint from a script.
3. **Add a real signing key** (`keytool -genkey …`) and keep the debug key out of release.
4. **Play Store**: $25 one-time, signed AAB, data-safety form, privacy policy URL.

## Environment variables

| Key | Purpose |
|---|---|
| `CONNEXA_SECRET` | Signs sessions, hashes OTPs. 32+ random chars. **Changing it logs everyone out.** |
| `CONNEXA_DB_PATH` | SQLite file location. Point at the mounted volume. |
| `CONNEXA_DEMO_LOGIN` | `0` disables the demo login and demo upgrade endpoints everywhere. |
| `CONNEXA_AUTOSEED` | `0` skips seeding fake profiles — launch empty. |
| `FIREBASE_PROJECT_ID` | Used to validate the `aud` claim of ID tokens. |

## Resetting test data

`POST /api/admin/reset` wipes every account and everything attached to it. It is
**disabled unless `CONNEXA_ADMIN_TOKEN` is set**, and the caller must send the same value
in an `x-admin-token` header.

```bash
curl -X POST https://your-app.onrender.com/api/admin/reset \
  -H "x-admin-token: YOUR_TOKEN"
```

On a host with an ephemeral disk a redeploy also clears the database, but this is
repeatable and does not require a build.

## Health check

```
GET /api/health  →  {"ok":true,"service":"connexa","database":"ok"}
```

Returns 503 if the database is unreachable, so Render will hold traffic until it recovers.
