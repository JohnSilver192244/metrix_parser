import assert from "node:assert/strict";
import test from "node:test";

import {
  readSessionStorageValue,
  writeSessionStorageValue,
} from "./session-storage";

function createStorage() {
  const store = new Map<string, string>();

  return {
    getItem(key: string) {
      return store.has(key) ? store.get(key) ?? null : null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
    removeItem(key: string) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

test("session storage helpers read and write JSON values", () => {
  const sessionStorage = createStorage();
  const previousWindow = globalThis.window;

  Object.defineProperty(globalThis, "window", {
    value: { sessionStorage },
    configurable: true,
    writable: true,
  });

  writeSessionStorageValue("filters", {
    seasonCode: "2026",
    playersCount: 32,
  });

  assert.deepEqual(readSessionStorageValue("filters", null), {
    seasonCode: "2026",
    playersCount: 32,
  });

  Object.defineProperty(globalThis, "window", {
    value: previousWindow,
    configurable: true,
    writable: true,
  });
});

test("session storage helpers return fallback for invalid payloads", () => {
  const sessionStorage = createStorage();
  const previousWindow = globalThis.window;

  Object.defineProperty(globalThis, "window", {
    value: { sessionStorage },
    configurable: true,
    writable: true,
  });

  sessionStorage.setItem("filters", "{not-json");

  assert.equal(readSessionStorageValue("filters", "fallback"), "fallback");

  Object.defineProperty(globalThis, "window", {
    value: previousWindow,
    configurable: true,
    writable: true,
  });
});
