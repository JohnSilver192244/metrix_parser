import assert from "node:assert/strict";
import test from "node:test";

import { listDivisions, resolveDivisionsTotal } from "./divisions";

test("listDivisions reads data and meta from the backend envelope", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    ({
      ok: true,
      text: async () =>
        JSON.stringify({
          data: [
            {
              code: "MPO",
            },
            {
              code: "FPO",
            },
          ],
          meta: {
            count: 2,
          },
        }),
    }) as Response) as typeof globalThis.fetch;

  try {
    const envelope = await listDivisions();

    assert.equal(envelope.meta?.count, 2);
    assert.equal(envelope.data[0]?.code, "MPO");
    assert.equal(resolveDivisionsTotal(envelope.data, envelope.meta), 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
