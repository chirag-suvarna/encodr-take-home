# Encodr — Fullstack Take-Home

```bash
npm install && npm run dev    # http://localhost:3000
npm run typecheck
npm run test:run
npm run test:e2e              # npx playwright install chromium first
```

**Login:** `demo@encodr.dev` / `password123`  
**Fail URL:** `https://cdn.example.com/videos/corrupt.mp4`

See [`BRIEF.md`](./BRIEF.md) for the assignment.

## Implementation

Filled the scaffold `TODO(candidate)` work so the encode flow runs end to end.

- **Auth** — HMAC access (~60s) + refresh (7d); `POST /api/auth/login` and `/refresh`; jobs/runs return 401 without a token.
- **Client auth** — `login()` stores tokens + user; `apiFetch` on 401 does one silent refresh and retries once; concurrent 401s share one refresh; failed refresh logs out to `/signin`.
- **Jobs API** — `GET/POST /api/jobs`, `GET /api/jobs/:id`; Zod `http(s)` URL on client and server; 422 `fieldErrors` map onto the form.
- **Runs** — `POST /api/runs`, `GET /api/runs/:id`; `computeRun(record, now)` walks QUEUED → … → COMPLETED in ~30s; corrupt URL fails after PROBING.
- **SSE** — `GET /api/runs/:id/events`; Bearer via `@microsoft/fetch-event-source`; abort on unmount; terminal COMPLETED/FAILED closes the stream.
- **UI** — jobs list + create form; job detail with Start encode, live stage/%, log, results, FAILED + Retry (new run, same job).
- **Tests** — Vitest/RTL for auth, jobs, `computeRun`, SSE, refresh, form mapping.

## Changes (beyond the core)

- SSE reconnect/resume: event `id`, `Last-Event-ID`, current `computeRun` snapshot, backoff (max 5). Reconnect = same run. Encode Retry = new run, same job.
- Optimistic job create with cache rollback, then invalidate.
- Playwright happy-path and fail/retry E2E.
- Light/dark theme (toggle, `localStorage`, system preference). No API changes.
- Vitest 3 (scaffold Vitest 4 does not start on Node 22.11).
