import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { User } from "@/lib/types";

// Mock auth — no real IdP. HMAC-signed compact tokens (body.sig), verified in-process.
// Access ~60s so the client's silent-refresh path is actually exercised; refresh lasts 7 days.
// SSE: prefer Authorization via @microsoft/fetch-event-source; also accept ?access_token=
// because native EventSource cannot set headers.

const SECRET = process.env.AUTH_SECRET ?? "encodr-dev-secret";
export const ACCESS_TTL_MS = 60_000;
export const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type TokenType = "access" | "refresh";

interface TokenPayload {
  sub: string;
  typ: TokenType;
  iat: number;
  exp: number;
  jti: string;
}

const USERS: (User & { password: string })[] = [
  { id: "u_demo", email: "demo@encodr.dev", name: "Demo User", password: "password123" },
];

export function authenticate(email: string, password: string): User | null {
  const user = USERS.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!user || user.password !== password) return null;
  const { password: _pw, ...safe } = user;
  return safe;
}

export function findUser(id: string): User | null {
  const user = USERS.find((u) => u.id === id);
  if (!user) return null;
  const { password: _pw, ...safe } = user;
  return safe;
}

function sign(payload: TokenPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verify(token: string, expectedType: TokenType): TokenPayload | null {
  const [body, sig] = token.split(".");
  if (!body || !sig || token.split(".").length !== 2) return null;

  const expected = createHmac("sha256", SECRET).update(body).digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!timingSafeEqual(sigBuf, expectedBuf)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as TokenPayload;
    if (payload.typ !== expectedType) return null;
    if (typeof payload.sub !== "string" || typeof payload.exp !== "number") return null;
    if (payload.exp <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function mint(userId: string, typ: TokenType, ttlMs: number): string {
  const now = Date.now();
  return sign({
    sub: userId,
    typ,
    iat: now,
    exp: now + ttlMs,
    jti: randomBytes(8).toString("hex"),
  });
}

export function issueTokens(userId: string): { accessToken: string; refreshToken: string } {
  return {
    accessToken: mint(userId, "access", ACCESS_TTL_MS),
    refreshToken: mint(userId, "refresh", REFRESH_TTL_MS),
  };
}

/** `ttlMs` is for tests (e.g. an already-expired token). Production callers omit it. */
export function issueAccessToken(userId: string, ttlMs: number = ACCESS_TTL_MS): string {
  return mint(userId, "access", ttlMs);
}

export function verifyAccessToken(token: string): string | null {
  return verify(token, "access")?.sub ?? null;
}

/** Verify a refresh token and return its subject (userId), or null. */
export function verifyRefreshToken(token: string): string | null {
  return verify(token, "refresh")?.sub ?? null;
}

/** Return the authenticated userId from the request, or null. */
export function getUserIdFromRequest(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (header?.toLowerCase().startsWith("bearer ")) {
    const userId = verifyAccessToken(header.slice("Bearer ".length).trim());
    if (userId) return userId;
  }

  try {
    const queryToken = new URL(req.url).searchParams.get("access_token");
    if (queryToken) return verifyAccessToken(queryToken);
  } catch {
    /* ignore malformed URL */
  }

  return null;
}
