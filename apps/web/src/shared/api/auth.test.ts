import assert from "node:assert/strict";
import test from "node:test";

import { getCurrentSession, login, logout, resolveAuthErrorMessage } from "./auth";
import { ApiClientError } from "./http";

test("getCurrentSession reads the current auth session from the backend envelope", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    ({
      ok: true,
      text: async () =>
        JSON.stringify({
          data: {
            authenticated: true,
            user: {
              login: "admin",
              createdAt: "2026-03-24T08:00:00.000Z",
            },
          },
        }),
    }) as Response) as typeof globalThis.fetch;

  try {
    const session = await getCurrentSession();

    assert.equal(session.authenticated, true);
    assert.equal(session.user?.login, "admin");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("login sends credentials and returns session token", async () => {
  const originalFetch = globalThis.fetch;
  let requestInit: RequestInit | undefined;

  globalThis.fetch = (async (_, init) => {
    requestInit = init;

    return {
      ok: true,
      text: async () =>
        JSON.stringify({
          data: {
            sessionToken: "session-100",
            session: {
              authenticated: true,
              user: {
                login: "admin",
              },
            },
          },
        }),
    } as Response;
  }) as typeof globalThis.fetch;

  try {
    const response = await login({
      login: "admin",
      password: "secret",
    });

    assert.equal(requestInit?.method, "POST");
    assert.equal(
      requestInit?.body,
      JSON.stringify({ login: "admin", password: "secret" }),
    );
    assert.equal(response.sessionToken, "session-100");
    assert.equal(response.session.user?.login, "admin");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("logout returns an anonymous auth session", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    ({
      ok: true,
      text: async () =>
        JSON.stringify({
          data: {
            authenticated: false,
            user: null,
          },
        }),
    }) as Response) as typeof globalThis.fetch;

  try {
    const session = await logout();

    assert.equal(session.authenticated, false);
    assert.equal(session.user, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("resolveAuthErrorMessage keeps API validation messages", () => {
  assert.equal(
    resolveAuthErrorMessage(new ApiClientError("invalid_credentials", "bad creds")),
    "Неверный логин или пароль.",
  );
  assert.equal(
    resolveAuthErrorMessage(new Error("boom")),
    "Не удалось выполнить вход.",
  );
});
