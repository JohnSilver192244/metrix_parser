import assert from "node:assert/strict";
import test from "node:test";

import {
  canUseUndiciDispatcher,
  shouldRetryWithoutDispatcher,
} from "./supabase-admin";

type RuntimeGlobals = typeof globalThis & {
  WebSocketPair?: unknown;
};

test("canUseUndiciDispatcher disables dispatcher init in workerd-like runtimes", () => {
  const runtimeGlobals = globalThis as RuntimeGlobals;
  const previousWebSocketPair = runtimeGlobals.WebSocketPair;

  try {
    Object.assign(runtimeGlobals, {
      WebSocketPair: class WebSocketPairMock {},
    });
    assert.equal(canUseUndiciDispatcher(), false);
  } finally {
    if (typeof previousWebSocketPair === "undefined") {
      delete runtimeGlobals.WebSocketPair;
    } else {
      Object.assign(runtimeGlobals, {
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
