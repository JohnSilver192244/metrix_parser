import assert from "node:assert/strict";
import test from "node:test";

import { listCompetitions, resolveCompetitionsTotal } from "./competitions";

test("listCompetitions reads data and meta from the backend envelope", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    ({
      ok: true,
      text: async () =>
        JSON.stringify({
          data: [
            {
              competitionId: "competition-501",
              competitionName: "Moscow Snow Cup",
              competitionDate: "2026-01-15",
              courseName: "Luzhniki",
              recordType: "league",
              playersCount: 24,
              metrixId: "metrix-501",
            },
          ],
          meta: {
            count: 1,
          },
        }),
    }) as Response) as typeof globalThis.fetch;

  try {
    const envelope = await listCompetitions();

    assert.equal(envelope.meta?.count, 1);
    assert.equal(envelope.data[0]?.competitionId, "competition-501");
    assert.equal(resolveCompetitionsTotal(envelope.data, envelope.meta), 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
