import { API_BASE_URL } from "@/lib/api";
import { clearAuthToken, setAuthToken } from "@/lib/auth";

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function getApiErrorMessage(body: unknown, fallback: string) {
  if (
    body &&
    typeof body === "object" &&
    "detail" in body &&
    Array.isArray(body.detail)
  ) {
    const detailMessages = body.detail
      .map((issue) => {
        if (
          issue &&
          typeof issue === "object" &&
          "msg" in issue &&
          typeof issue.msg === "string"
        ) {
          return issue.msg.trim();
        }
        return null;
      })
      .filter((entry): entry is string => Boolean(entry));

    if (detailMessages.length) {
      return detailMessages.join(", ");
    }
  }

  if (
    body &&
    typeof body === "object" &&
    "detail" in body &&
    typeof body.detail === "string" &&
    body.detail.trim()
  ) {
    return body.detail;
  }

  if (
    body &&
    typeof body === "object" &&
    "message" in body &&
    typeof body.message === "string" &&
    body.message.trim()
  ) {
    return body.message;
  }

  return fallback;
}

type ApiRequestOptions = {
  token?: string;
  init?: RequestInit;
  baseUrl?: string;
  errorFallback?: string;
  skipRefreshRetry?: boolean;
};

export type RequestFn = <T>(
  path: string,
  token: string,
  init?: RequestInit,
) => Promise<T>;

type RefreshTokenResponse = {
  access_token: string;
};

async function tryRefreshAccessToken(baseUrl: string): Promise<string | null> {
  const response = await fetch(`${baseUrl}/auth/refresh`, {
    method: "POST",
    cache: "no-store",
    credentials: "include",
  });

  if (!response.ok) {
    return null;
  }

  const body = (await response.json()) as RefreshTokenResponse;
  if (!body.access_token) {
    return null;
  }

  setAuthToken(body.access_token);
  return body.access_token;
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const {
    token,
    init,
    baseUrl = API_BASE_URL,
    errorFallback = "Request failed",
    skipRefreshRetry = false,
  } = options;

  const headers: HeadersInit = { ...(init?.headers ?? {}) };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (!(init?.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
    cache: "no-store",
    credentials: "include",
  });

  if (!response.ok) {
    const canRetryWithRefresh =
      response.status === 401 &&
      !skipRefreshRetry &&
      Boolean(token) &&
      path !== "/auth/login" &&
      path !== "/auth/refresh";
    if (canRetryWithRefresh) {
      const nextToken = await tryRefreshAccessToken(baseUrl);
      if (nextToken) {
        return apiRequest<T>(path, {
          ...options,
          token: nextToken,
          skipRefreshRetry: true,
        });
      }
      clearAuthToken();
    }

    let detail = errorFallback;
    try {
      const body = await response.json();
      detail = getApiErrorMessage(body, detail);
    } catch {
      detail = `${response.status} ${response.statusText}`;
    }
    throw new ApiError(detail, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
