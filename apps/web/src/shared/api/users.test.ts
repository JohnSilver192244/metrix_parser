import assert from "node:assert/strict";
import test from "node:test";

import { listUsers, resolveUsersTotal } from "./users";

test("listUsers reads data and meta from the backend envelope", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    ({
      ok: true,
      text: async () =>
        JSON.stringify({
          data: [
            {
              login: "admin",
              createdAt: "2026-03-24T08:00:00.000Z",
            },
          ],
          meta: {
            count: 1,
          },
        }),
    }) as Response) as typeof globalThis.fetch;

  try {
    const envelope = await listUsers();

    assert.equal(envelope.meta?.count, 1);
    assert.equal(envelope.data[0]?.login, "admin");
    assert.equal(resolveUsersTotal(envelope.data, envelope.meta), 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
