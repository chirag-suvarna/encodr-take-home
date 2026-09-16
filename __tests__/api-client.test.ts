import { afterEach, describe, expect, it, vi } from "vitest";
import { api, AUTH_LOGOUT_EVENT } from "@/lib/client/api";
import { clearTokens, getAccessToken, setTokens } from "@/lib/client/token-store";

afterEach(() => {
  clearTokens();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("api silent refresh", () => {
  it("refreshes once on 401 and retries the original request", async () => {
    setTokens({ accessToken: "expired", refreshToken: "refresh-me" });

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const auth = (init?.headers as Record<string, string> | undefined)?.authorization;
      if (url.includes("/api/auth/refresh")) {
        return new Response(JSON.stringify({ accessToken: "fresh" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (auth === "Bearer expired") {
        return new Response(JSON.stringify({ detail: "Not authenticated" }), {
          status: 401,
          headers: { "content-type": "application/json" },
        });
      }
      if (auth === "Bearer fresh") {
        return new Response(JSON.stringify([{ id: "j_1" }]), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response("unexpected", { status: 500 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const jobs = await api.get<{ id: string }[]>("/api/jobs");
    expect(jobs).toEqual([{ id: "j_1" }]);
    expect(getAccessToken()).toBe("fresh");
    expect(fetchMock.mock.calls.filter((c) => String(c[0]).includes("/api/auth/refresh"))).toHaveLength(
      1,
    );
  });

  it("shares one in-flight refresh across concurrent 401s", async () => {
    setTokens({ accessToken: "expired", refreshToken: "refresh-me" });
    let refreshCalls = 0;
    let releaseRefresh: () => void = () => {};
    const refreshGate = new Promise<void>((resolve) => {
      releaseRefresh = resolve;
    });

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const auth = (init?.headers as Record<string, string> | undefined)?.authorization;
      if (url.includes("/api/auth/refresh")) {
        refreshCalls += 1;
        await refreshGate;
        return new Response(JSON.stringify({ accessToken: "fresh" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (auth === "Bearer expired") {
        return new Response(JSON.stringify({ detail: "Not authenticated" }), {
          status: 401,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const pending = Promise.all([api.get("/api/jobs"), api.get("/api/jobs")]);
    await vi.waitFor(() => expect(refreshCalls).toBe(1));
    releaseRefresh();
    await pending;
    expect(refreshCalls).toBe(1);
  });

  it("clears auth and dispatches logout when refresh fails", async () => {
    setTokens({ accessToken: "expired", refreshToken: "dead" });
    const logout = vi.fn();
    window.addEventListener(AUTH_LOGOUT_EVENT, logout);

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/auth/refresh")) {
          return new Response(JSON.stringify({ detail: "Invalid refresh token" }), {
            status: 401,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ detail: "Not authenticated" }), {
          status: 401,
          headers: { "content-type": "application/json" },
        });
      }),
    );

    await expect(api.get("/api/jobs")).rejects.toMatchObject({ status: 401 });
    expect(getAccessToken()).toBeNull();
    expect(logout).toHaveBeenCalledOnce();
    window.removeEventListener(AUTH_LOGOUT_EVENT, logout);
  });

  it("does not attempt refresh on /api/auth/login 401", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ detail: "Invalid email or password" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(api.post("/api/auth/login", { email: "a@b.c", password: "x" })).rejects.toMatchObject({
      status: 401,
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
