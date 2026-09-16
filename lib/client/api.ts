import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from "@/lib/client/token-store";

export class ApiError extends Error {
  status: number;
  /** Field-level errors from a 422, keyed by form field name. */
  fieldErrors?: Record<string, string[]>;
  constructor(status: number, message: string, fieldErrors?: Record<string, string[]>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

/** Fired when auth is unrecoverable. The auth provider listens for this and logs the user out. */
export const AUTH_LOGOUT_EVENT = "encodr:logout";

async function parseError(res: Response): Promise<ApiError> {
  let detail = res.statusText || "Request failed";
  let fieldErrors: Record<string, string[]> | undefined;
  try {
    const body = await res.json();
    if (body?.detail) detail = body.detail;
    if (body?.fieldErrors) {
      fieldErrors = body.fieldErrors;
      detail = "Validation failed";
    }
  } catch {
    /* non-JSON body */
  }
  return new ApiError(res.status, detail, fieldErrors);
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
}

/** Concurrent 401s share this single in-flight refresh instead of a stampede. */
let refreshInFlight: Promise<boolean> | null = null;

function isAuthPath(path: string) {
  return path.startsWith("/api/auth/");
}

function forceLogout() {
  clearTokens();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_LOGOUT_EVENT));
  }
}

async function refreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return false;
    try {
      const res = await fetch("/api/auth/refresh", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return false;
      const data = (await res.json()) as { accessToken?: string };
      if (!data.accessToken) return false;
      setTokens({ accessToken: data.accessToken });
      return true;
    } catch {
      return false;
    }
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

async function request<T>(path: string, options: RequestOptions = {}, isRetry = false): Promise<T> {
  const headers: Record<string, string> = {};
  const access = getAccessToken();
  if (access) headers["authorization"] = `Bearer ${access}`;
  if (options.body !== undefined) headers["content-type"] = "application/json";

  const res = await fetch(path, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  });

  // 401 → one shared refresh → retry this request once. Never loops: isRetry skips this branch.
  if (res.status === 401 && !isRetry && !isAuthPath(path)) {
    const refreshed = await refreshAccessToken();
    if (refreshed) return request<T>(path, options, true);
    forceLogout();
    throw await parseError(res);
  }

  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) => request<T>(path, { signal }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body }),
};
