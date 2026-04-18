import assert from "node:assert/strict";
import test from "node:test";
import {
  Request as UndiciRequest,
  Response as UndiciResponse,
} from "undici";

import {
  createCloudflareAppShell,
  resolveCloudflareAppShellEnv,
  shouldHandleWithApi,
} from "./app-shell";

if (typeof globalThis.Request === "undefined") {
  globalThis.Request = UndiciRequest as unknown as typeof globalThis.Request;
}

if (typeof globalThis.Response === "undefined") {
  globalThis.Response = UndiciResponse as unknown as typeof globalThis.Response;
}

test("shouldHandleWithApi sends SPA document navigations to static assets", () => {
  const request = new Request("https://example.com/competitions", {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "Sec-Fetch-Dest": "document",
    },
  });

  assert.equal(shouldHandleWithApi(request), false);
});

test("shouldHandleWithApi keeps JSON/data fetches on the API handler even for SPA-overlapping routes", () => {
  const request = new Request("https://example.com/competitions", {
    headers: {
      Accept: "*/*",
    },
  });

  assert.equal(shouldHandleWithApi(request), true);
});

test("shouldHandleWithApi keeps asset requests on the assets binding", () => {
  const request = new Request("https://example.com/assets/index.js");

  assert.equal(shouldHandleWithApi(request), false);
});

test("Cloudflare app shell serves SPA navigations from assets", async () => {
  const shell = createCloudflareAppShell(async () => new Response("api"));
  let assetRequestUrl = "";

  const response = await shell.fetch(
    new Request("https://example.com/competitions", {
      headers: {
        Accept: "text/html",
        "Sec-Fetch-Dest": "document",
      },
    }),
    {
      ASSETS: {
        fetch: async (request) => {
          assetRequestUrl = request.url;
          return new Response("spa-shell");
        },
      },
    },
  );

  assert.equal(assetRequestUrl, "https://example.com/competitions");
  assert.equal(await response.text(), "spa-shell");
});

test("Cloudflare app shell serves non-document overlapping routes from the API handler", async () => {
  let apiRequestUrl = "";
  const shell = createCloudflareAppShell(async (request) => {
    apiRequestUrl = request.url;
    return new Response(JSON.stringify({ ok: true }), {
      headers: {
        "Content-Type": "application/json",
      },
    });
  });

  const response = await shell.fetch(
    new Request("https://example.com/competitions", {
      headers: {
        Accept: "*/*",
      },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("assets"),
      },
    },
  );

  assert.equal(apiRequestUrl, "https://example.com/competitions");
  assert.equal(response.headers.get("Content-Type"), "application/json");
  assert.deepEqual(await response.json(), { ok: true });
});

test("resolveCloudflareAppShellEnv falls back to build-time local env constants", () => {
  const previous = {
    supabaseUrl: globalThis.__LOCAL_SUPABASE_URL__,
    supabaseServiceRoleKey: globalThis.__LOCAL_SUPABASE_SERVICE_ROLE_KEY__,
    discGolfMetrixBaseUrl: globalThis.__LOCAL_DISCGOLFMETRIX_BASE_URL__,
    discGolfMetrixCountryCode: globalThis.__LOCAL_DISCGOLFMETRIX_COUNTRY_CODE__,
    discGolfMetrixApiCode: globalThis.__LOCAL_DISCGOLFMETRIX_API_CODE__,
  };

  Object.assign(globalThis, {
    __LOCAL_SUPABASE_URL__: "https://supabase.example",
    __LOCAL_SUPABASE_SERVICE_ROLE_KEY__: "service-role-key",
    __LOCAL_DISCGOLFMETRIX_BASE_URL__: "https://discgolfmetrix.com",
    __LOCAL_DISCGOLFMETRIX_COUNTRY_CODE__: "RU",
    __LOCAL_DISCGOLFMETRIX_API_CODE__: "secret",
  });

  try {
    const resolved = resolveCloudflareAppShellEnv({
      ASSETS: {
        fetch: async () => new Response("assets"),
      },
    });

    assert.equal(resolved.supabaseUrl, "https://supabase.example");
    assert.equal(resolved.supabaseServiceRoleKey, "service-role-key");
    assert.equal(resolved.discGolfMetrixBaseUrl, "https://discgolfmetrix.com");
    assert.equal(resolved.discGolfMetrixCountryCode, "RU");
    assert.equal(resolved.discGolfMetrixApiCode, "secret");
  } finally {
    Object.assign(globalThis, {
      __LOCAL_SUPABASE_URL__: previous.supabaseUrl,
      __LOCAL_SUPABASE_SERVICE_ROLE_KEY__: previous.supabaseServiceRoleKey,
      __LOCAL_DISCGOLFMETRIX_BASE_URL__: previous.discGolfMetrixBaseUrl,
      __LOCAL_DISCGOLFMETRIX_COUNTRY_CODE__: previous.discGolfMetrixCountryCode,
      __LOCAL_DISCGOLFMETRIX_API_CODE__: previous.discGolfMetrixApiCode,
    });
  }
});

test("Cloudflare app shell dispatches known scheduled cron jobs through the unified runtime", async () => {
  let receivedCron = "";
  const shell = createCloudflareAppShell(
    async () => new Response("api"),
    async (controller) => {
      receivedCron = controller.cron;
      return true;
    },
  );

  await shell.scheduled(
    {
      cron: "0 1 * * *",
      scheduledTime: Date.UTC(2026, 3, 16, 1, 0, 0),
    },
    {
      ASSETS: {
        fetch: async () => new Response("assets"),
      },
    },
    {
      waitUntil() {},
    },
  );

  assert.equal(receivedCron, "0 1 * * *");
});
