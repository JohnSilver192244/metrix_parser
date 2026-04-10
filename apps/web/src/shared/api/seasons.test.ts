import assert from "node:assert/strict";
import test from "node:test";

import { listSeasons, resolveSeasonsTotal } from "./seasons";

test("listSeasons reads data and meta from the backend envelope", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    ({
      ok: true,
      text: async () =>
        JSON.stringify({
          data: [
            {
              seasonCode: "2026",
              name: "Сезон РДГА 2026",
              dateFrom: "2026-04-01",
              dateTo: "2026-11-01",
              bestLeaguesCount: 4,
              bestTournamentsCount: 4,
            },
          ],
          meta: {
            count: 1,
          },
        }),
    }) as Response) as typeof globalThis.fetch;

  try {
    const envelope = await listSeasons();

    assert.equal(envelope.meta?.count, 1);
    assert.equal(envelope.data[0]?.seasonCode, "2026");
    assert.equal(resolveSeasonsTotal(envelope.data, envelope.meta), 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
