import { describe, expect, it } from "vitest";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as refresh } from "@/app/api/auth/refresh/route";
import { GET as listJobs } from "@/app/api/jobs/route";
import {
  getUserIdFromRequest,
  issueAccessToken,
  issueTokens,
  verifyAccessToken,
  verifyRefreshToken,
} from "@/lib/server/auth";

function jsonRequest(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("tokens", () => {
  it("issues a verifiable access token and a longer-lived refresh token", () => {
    const { accessToken, refreshToken } = issueTokens("u_demo");
    expect(verifyAccessToken(accessToken)).toBe("u_demo");
    expect(verifyRefreshToken(refreshToken)).toBe("u_demo");
  });

  it("rejects an access token used as a refresh token (and vice versa)", () => {
    const { accessToken, refreshToken } = issueTokens("u_demo");
    expect(verifyRefreshToken(accessToken)).toBeNull();
    expect(verifyAccessToken(refreshToken)).toBeNull();
  });

  it("rejects an expired access token", () => {
    const expired = issueAccessToken("u_demo", -1_000);
    expect(verifyAccessToken(expired)).toBeNull();
  });

  it("rejects a tampered token", () => {
    const { accessToken } = issueTokens("u_demo");
    expect(verifyAccessToken(accessToken + "x")).toBeNull();
    expect(verifyAccessToken("not-a-token")).toBeNull();
  });
});

describe("getUserIdFromRequest", () => {
  it("reads a Bearer access token", () => {
    const access = issueAccessToken("u_demo");
    const req = new Request("http://localhost/api/jobs", {
      headers: { authorization: `Bearer ${access}` },
    });
    expect(getUserIdFromRequest(req)).toBe("u_demo");
  });

  it("reads ?access_token= as a fallback for SSE", () => {
    const access = issueAccessToken("u_demo");
    const req = new Request(`http://localhost/api/runs/r1/events?access_token=${access}`);
    expect(getUserIdFromRequest(req)).toBe("u_demo");
  });

  it("returns null when the header is missing or invalid", () => {
    expect(getUserIdFromRequest(new Request("http://localhost/api/jobs"))).toBeNull();
    expect(
      getUserIdFromRequest(
        new Request("http://localhost/api/jobs", { headers: { authorization: "Bearer nope" } }),
      ),
    ).toBeNull();
  });
});

describe("POST /api/auth/login", () => {
  it("returns tokens and the user for the demo credentials", async () => {
    const res = await login(
      jsonRequest("http://localhost/api/auth/login", {
        email: "demo@encodr.dev",
        password: "password123",
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user).toEqual({ id: "u_demo", email: "demo@encodr.dev", name: "Demo User" });
    expect(verifyAccessToken(body.accessToken)).toBe("u_demo");
    expect(verifyRefreshToken(body.refreshToken)).toBe("u_demo");
  });

  it("returns 401 for a bad password", async () => {
    const res = await login(
      jsonRequest("http://localhost/api/auth/login", {
        email: "demo@encodr.dev",
        password: "wrong",
      }),
    );
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ detail: "Invalid email or password" });
  });

  it("returns 422 field errors for an invalid body", async () => {
    const res = await login(
      jsonRequest("http://localhost/api/auth/login", { email: "not-an-email", password: "" }),
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.fieldErrors.email).toBeDefined();
    expect(body.fieldErrors.password).toBeDefined();
  });
});

describe("POST /api/auth/refresh", () => {
  it("exchanges a valid refresh token for a new access token", async () => {
    const { refreshToken } = issueTokens("u_demo");
    const res = await refresh(
      jsonRequest("http://localhost/api/auth/refresh", { refreshToken }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(verifyAccessToken(body.accessToken)).toBe("u_demo");
  });

  it("rejects an access token or junk", async () => {
    const access = issueAccessToken("u_demo");
    const asAccess = await refresh(
      jsonRequest("http://localhost/api/auth/refresh", { refreshToken: access }),
    );
    expect(asAccess.status).toBe(401);

    const junk = await refresh(
      jsonRequest("http://localhost/api/auth/refresh", { refreshToken: "nope" }),
    );
    expect(junk.status).toBe(401);
  });
});

describe("protected routes", () => {
  it("returns 401 without a token and 501 with a valid one (handler still stubbed)", async () => {
    const unauth = await listJobs(new Request("http://localhost/api/jobs"));
    expect(unauth.status).toBe(401);

    const access = issueAccessToken("u_demo");
    const authd = await listJobs(
      new Request("http://localhost/api/jobs", { headers: { authorization: `Bearer ${access}` } }),
    );
    expect(authd.status).toBe(501);
  });
});
