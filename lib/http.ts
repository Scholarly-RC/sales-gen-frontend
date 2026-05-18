import { API_BASE_URL } from "@/lib/api";

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
};

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const {
    token,
    init,
    baseUrl = API_BASE_URL,
    errorFallback = "Request failed",
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
  });

  if (!response.ok) {
    let detail = errorFallback;
    try {
      const body = await response.json();
      detail = getApiErrorMessage(body, detail);
    } catch {
      detail = `${response.status} ${response.statusText}`;
    }
    throw new Error(detail);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
