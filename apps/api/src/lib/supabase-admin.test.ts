import assert from "node:assert/strict";
import test from "node:test";

import {
  canUseUndiciDispatcher,
  shouldRetryWithoutDispatcher,
} from "./supabase-admin";

test("canUseUndiciDispatcher disables dispatcher init in workerd-like runtimes", () => {
  const previousWebSocketPair = globalThis.WebSocketPair;

  try {
    Object.assign(globalThis, {
      WebSocketPair: class WebSocketPairMock {},
    });
    assert.equal(canUseUndiciDispatcher(), false);
  } finally {
    if (typeof previousWebSocketPair === "undefined") {
      delete (globalThis as typeof globalThis & { WebSocketPair?: unknown }).WebSocketPair;
    } else {
      Object.assign(globalThis, {
        WebSocketPair: previousWebSocketPair,
      });
    }
  }
});

test("shouldRetryWithoutDispatcher matches dispatcher init incompatibility errors", () => {
  assert.equal(
    shouldRetryWithoutDispatcher(
      new TypeError("Failed to execute 'fetch': unexpected option dispatcher"),
    ),
    true,
  );
  assert.equal(
    shouldRetryWithoutDispatcher(
      new TypeError("Fetch API: invalid init option provided in workerd runtime"),
    ),
    true,
  );
});

test("shouldRetryWithoutDispatcher ignores unrelated errors", () => {
  assert.equal(
    shouldRetryWithoutDispatcher(new Error("network timeout")),
    false,
  );
  assert.equal(
    shouldRetryWithoutDispatcher(new TypeError("fetch failed")),
    false,
  );
});
