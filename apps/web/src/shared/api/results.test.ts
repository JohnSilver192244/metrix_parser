import assert from "node:assert/strict";
import test from "node:test";

import { listResults, resolveResultsTotal } from "./results";

test("listResults reads data and meta from the backend envelope", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";

  globalThis.fetch = (async (input) => {
    requestedUrl = String(input);

    return {
      ok: true,
      text: async () =>
        JSON.stringify({
          data: [
            {
              competitionId: "competition-321",
              playerId: "player-321",
              className: "MPO",
              sum: 56,
              diff: -4,
              orderNumber: 3,
              dnf: false,
              seasonPoints: 52.9,
            },
          ],
          meta: {
            count: 1,
          },
        }),
    } as Response;
  }) as typeof globalThis.fetch;

  try {
    const envelope = await listResults({
      competitionId: "competition-321",
    });

    assert.equal(envelope.meta?.count, 1);
    assert.equal(envelope.data[0]?.competitionId, "competition-321");
    assert.equal(envelope.data[0]?.seasonPoints, 52.9);
    assert.equal(resolveResultsTotal(envelope.data, envelope.meta), 1);
    assert.match(requestedUrl, /\/results\?competitionId=competition-321$/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
