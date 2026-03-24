const AUTH_TOKEN_STORAGE_KEY = "metrix-parser-session-token";

let sessionTokenCache: string | null | undefined;

function getStorage(): Storage | null {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }

  return window.localStorage;
}

export function getStoredSessionToken(): string | null {
  if (sessionTokenCache !== undefined) {
    return sessionTokenCache;
  }

  const storage = getStorage();
  sessionTokenCache = storage?.getItem(AUTH_TOKEN_STORAGE_KEY) ?? null;

  return sessionTokenCache;
}

export function setStoredSessionToken(sessionToken: string | null): void {
  sessionTokenCache = sessionToken;

  const storage = getStorage();
  if (!storage) {
    return;
  }

  if (sessionToken) {
    storage.setItem(AUTH_TOKEN_STORAGE_KEY, sessionToken);
    return;
  }

  storage.removeItem(AUTH_TOKEN_STORAGE_KEY);
}

export function clearStoredSessionToken(): void {
  setStoredSessionToken(null);
}
