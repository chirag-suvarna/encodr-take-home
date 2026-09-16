# Encodr — Fullstack Take-Home

A media transcoding dashboard: sign in, create an encode **job** from a URL, start a **run**, watch
**live SSE progress**, and see **renditions** (or a clear failure + retry).

The assignment brief is in [`BRIEF.md`](./BRIEF.md).

## How to run

Requires **Node 20.19+** or **22.12+** (Vitest 4). Node 20 is specified in `.nvmrc`.

```bash
npm install
npm run dev        # http://localhost:3000
```

## How to test

```bash
npm run typecheck  # tsc --noEmit
npm run test:run   # Vitest + Testing Library
npm run build      # production build
```

Tests live in `__tests__/`. They cover login/tokens, job CRUD + URL validation, `computeRun` stages
and the fail URL, run APIs, SSE terminal/cleanup, silent refresh, and the create-job form (RTL).

## Demo credentials

| | |
|---|---|
| Email | `demo@encodr.dev` |
| Password | `password123` |

Fail path (always dies after PROBING):  
`https://cdn.example.com/videos/corrupt.mp4`

Happy path: any other `https://…/…` URL, e.g. `https://cdn.example.com/videos/movie.mp4`.

## Architecture

One **Next.js App Router** app is the UI and the API (BFF). No extra backend, no database.

```
Browser
  AuthContext + localStorage tokens
  React Query + RHF/Zod
  useRunStream (fetch-event-source + Bearer)
        │
        ▼
Route Handlers  app/api/**
  withAuth → HMAC access token
  store.ts  (jobs/runs Maps on globalThis)
  computeRun(record, now)  ← pure, elapsed time only
```

- **Job** = source URL + title + status derived from the latest run.
- **Run** = time-based state machine (~30s):  
  `QUEUED → DOWNLOADING → PROBING → TRANSCODING → PACKAGING → COMPLETED`  
  Fail URL: `QUEUED → DOWNLOADING → PROBING → FAILED` at 12s.
- Retry **starts a new run**. The failed run is not rewritten.
- Maps sit on `globalThis` so Next route bundles share one in-memory store.

## Authentication design

HMAC-signed compact tokens (`body.sig`) in `lib/server/auth.ts`. No JWT library.

| Token | TTL | Use |
|---|---|---|
| Access | **~60s** | `Authorization: Bearer` on `/api/jobs*` and `/api/runs*` |
| Refresh | 7 days | `POST /api/auth/refresh` → new access token |

Access cannot be used as refresh (`typ` is checked). Missing/invalid auth → **401**.  
`POST /api/auth/login` returns `{ accessToken, refreshToken, user }`. One hard-coded demo user.

## SSE authentication

Native `EventSource` cannot set `Authorization`. The client uses `@microsoft/fetch-event-source`
(already in the scaffold) with the **same Bearer header** as every other call:

```
GET /api/runs/:id/events
Authorization: Bearer <accessToken>
```

The route is wrapped in `withAuth`. `useRunStream` aborts on unmount / `runId` change so the server
`setInterval` is cleared (`req.signal` + stream `cancel`).

**Reconnect / resume (stretch):** each SSE frame has an `id`. A network blip retries after 1s and
sends `Last-Event-ID`; the server immediately emits the **current** `computeRun(now)` snapshot (state
is time-derived, not a replay log). Unmount and terminal COMPLETED/FAILED set `cancelled` and abort —
those do **not** reconnect.

**Not used as the primary path**

- **Query token** — leaks via logs, proxies, and history.
- **Cookies** — would be a second auth mechanism on top of memory + `localStorage`, plus CSRF.

The server still accepts `?access_token=` so `curl` can subscribe. The browser app never puts the
token in the URL.

## Refresh / retry

Access TTL is short on purpose so this path is exercised.

```
request → 401?
  no  → done
  yes → POST /api/auth/refresh  (one shared in-flight promise)
          → success: retry the original request **once**
          → failure: clear tokens, dispatch `encodr:logout` → /signin
```

Login/refresh 401s do not recurse. Concurrent 401s share **one** refresh, then each caller retries
with the new access token.

## Assumptions

- Encode is **simulated** (`elapsed = now - startedAt`). There is no real ffmpeg/worker.
- Process-local memory is enough; restarting `next dev` wipes jobs/runs.
- One demo user is enough; no sign-up, roles, or multi-tenant isolation.
- A job has many runs over time; the list/detail UI shows the **latest** run.
- Source URLs must be `http(s)` with a path; file extensions are not required (signed URLs often omit them).

## Trade-offs

| Choice | Why | Cost |
|---|---|---|
| In-memory `Map` | Matches the brief; easy to test | Lost on restart; not multi-instance |
| `globalThis` store | Next can evaluate the module per route | Slightly unusual; documented |
| HMAC tokens, no `jose` | Small, no extra dep | Not a standards JWT |
| Bearer SSE via fetch-event-source | One auth story, abortable | Not the native EventSource API |
| Shared refresh promise | Avoids a stampede | Slightly more client code |
| Pure `computeRun(now)` | Deterministic tests, no timers in the state machine | SSE polls every 250ms instead of pushing from a worker |

## What I’d do with more time

- Persist jobs/runs (SQLite or similar) and survive restarts.
- Rotate/revoke refresh tokens; encrypt `localStorage` or move to httpOnly cookies with CSRF.
- Re-auth the SSE stream if the 60s access token expires mid-run (~30s today, so it usually fits).
- Paginate the job list; keep a short run history on the detail page (run 1 FAILED, run 2 COMPLETED).
- Swap the simulator for a real transcode worker behind the same `EncodeRun` contract.
