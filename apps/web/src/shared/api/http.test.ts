import assert from "node:assert/strict";
import test from "node:test";

import { resolveApiBaseUrl } from "./http";

test("resolveApiBaseUrl prefers same-origin loopback app shell in local dev", () => {
  assert.equal(
    resolveApiBaseUrl({
      configuredBaseUrl: "http://localhost:3001",
      isDev: true,
      windowOrigin: "http://localhost:5173",
    }),
    "http://localhost:5173",
  );
});

test("resolveApiBaseUrl preserves configured non-loopback api base url", () => {
  assert.equal(
    resolveApiBaseUrl({
      configuredBaseUrl: "https://api.example.com",
      isDev: true,
      windowOrigin: "http://localhost:5173",
    }),
    "https://api.example.com",
  );
});
