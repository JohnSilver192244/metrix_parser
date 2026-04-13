import assert from "node:assert/strict";
import test from "node:test";

import { listResults, resolveResultsTotal } from "./results";

test("listResults reads data and meta from the backend envelope", async () => {
  const originalFetch = globalThis.fetch;
  let requestPathname = "";
  let requestCompetitionId = "";
  let requestLimit = "";
  let requestOffset = "";

  globalThis.fetch = (async (input) => {
    const parsedUrl = new URL(String(input));
    requestPathname = parsedUrl.pathname;
    requestCompetitionId = parsedUrl.searchParams.get("competitionId") ?? "";
    requestLimit = parsedUrl.searchParams.get("limit") ?? "";
    requestOffset = parsedUrl.searchParams.get("offset") ?? "";

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
    assert.equal(requestPathname, "/results");
    assert.equal(requestCompetitionId, "competition-321");
    assert.equal(requestLimit, "1000");
    assert.equal(requestOffset, "0");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("listResults loads all pages and returns merged meta count", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;

  globalThis.fetch = (async (input) => {
    const parsedUrl = new URL(String(input));
    const offset = Number(parsedUrl.searchParams.get("offset") ?? "0");
    calls += 1;

    const pageSize = offset === 0 ? 1000 : 2;
    const data = Array.from({ length: pageSize }, (_, index) => ({
      competitionId: `competition-${offset + index + 1}`,
      playerId: `player-${offset + index + 1}`,
      className: "MPO",
      sum: 56,
      diff: -4,
      dnf: false,
      seasonPoints: 52.9,
    }));

    return {
      ok: true,
      text: async () =>
        JSON.stringify({
          data,
          meta: {
            count: data.length,
            limit: 1000,
            offset,
          },
        }),
    } as Response;
  }) as typeof globalThis.fetch;

  try {
    const envelope = await listResults({
      competitionId: "competition-322",
    });

    assert.equal(calls, 2);
    assert.equal(envelope.data.length, 1002);
    assert.equal(envelope.meta?.count, 1002);
    assert.equal(envelope.data[1001]?.playerId, "player-1002");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
