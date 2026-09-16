# Encodr — Fullstack Take-Home

A small **media transcoding dashboard**: sign in, create an encode **job** from a media URL, start a
**run**, watch **live SSE progress**, and see **output renditions** (or a clear failure).

The brief is in **`BRIEF.md`**.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm run test:run
npm run typecheck
npm run build
```

Requires **Node 20+**. **Demo login:** `demo@encodr.dev` / `password123`.

Use `https://cdn.example.com/videos/corrupt.mp4` as a source URL to exercise the fail path
(`QUEUED → DOWNLOADING → PROBING → FAILED` at ~12s).

## Design decisions

### SSE auth — Bearer via `@microsoft/fetch-event-source`

Native `EventSource` cannot set an `Authorization` header. The stream is opened with
`@microsoft/fetch-event-source` (already in the scaffold) and the same header as every other API
call:

```
Authorization: Bearer <accessToken>
```

`GET /api/runs/:id/events` is wrapped in `withAuth`. The client hook (`lib/client/use-run-stream.ts`)
passes the access token and aborts the request on unmount so the server timer is cleared.

**Why not a query token as the primary path?** Tokens in URLs leak through logs, proxies, and history.
**Why not cookies?** This app stores tokens in memory + `localStorage` and has no cookie/CSRF setup;
a cookie-only SSE path would be a second auth mechanism.

The server also accepts `?access_token=` as a fallback for `curl` / debugging. The browser app never
puts the token in the query string.

### Silent refresh

Access tokens live **~60s**. On `401`, `lib/client/api.ts` POSTs `/api/auth/refresh` once and retries
the original request. Concurrent 401s share a **single** in-flight refresh. If refresh fails, tokens
are cleared and `encodr:logout` sends the user to `/signin`. Login/refresh 401s do not recurse.

## Still to build

- Job detail screen: start/retry, live progress + log (`useRunStream`), FAILED + results table.
