import assert from "node:assert/strict";
import test from "node:test";

import { runSeasonPointsAccrual } from "./season-standings";

test("runSeasonPointsAccrual sends payload to backend", async () => {
  const originalFetch = globalThis.fetch;
  let requestPathname = "";
  let requestInit: RequestInit | undefined;

  globalThis.fetch = (async (input, init) => {
    requestPathname = new URL(String(input)).pathname;
    requestInit = init;

    return {
      ok: true,
      text: async () =>
        JSON.stringify({
          data: {
            seasonCode: "2026",
            overwriteExisting: true,
            competitionsInSeason: 8,
            competitionsEligible: 7,
            competitionsSkippedByExisting: 0,
            competitionsWithPoints: 7,
            rowsPrepared: 121,
            rowsPersisted: 121,
          },
        }),
    } as Response;
  }) as typeof globalThis.fetch;

  try {
    const result = await runSeasonPointsAccrual({
      seasonCode: "2026",
      overwriteExisting: true,
    });

    assert.equal(requestPathname, "/season-standings/accrual");
    assert.equal(requestInit?.method, "POST");
    assert.equal(
      requestInit?.body,
      JSON.stringify({
        seasonCode: "2026",
        overwriteExisting: true,
      }),
    );
    assert.equal(result.rowsPersisted, 121);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
