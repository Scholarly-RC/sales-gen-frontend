export const ACCESS_TOKEN_KEY = "sales_gen_access_token";
export const REFRESH_TOKEN_COOKIE = "sales_gen_refresh_token";
const AUTH_TOKEN_EVENT = "sales-gen-auth-token-change";

function dispatchAuthTokenChange() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(AUTH_TOKEN_EVENT));
}

export function setAuthToken(token: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
  dispatchAuthTokenChange();
}

export function clearAuthToken() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  dispatchAuthTokenChange();
}

export function getStoredAuthToken() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function subscribeToAuthTokenChanges(callback: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleChange = () => {
    callback();
  };

  window.addEventListener("storage", handleChange);
  window.addEventListener(AUTH_TOKEN_EVENT, handleChange);

  return () => {
    window.removeEventListener("storage", handleChange);
    window.removeEventListener(AUTH_TOKEN_EVENT, handleChange);
  };
}
