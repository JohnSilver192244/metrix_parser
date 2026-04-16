import assert from "node:assert/strict";
import test from "node:test";
import {
  Request as UndiciRequest,
  Response as UndiciResponse,
} from "undici";

import { createCloudflareAppShell, shouldHandleWithApi } from "./app-shell";

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
