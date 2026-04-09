import assert from "node:assert/strict";
import test from "node:test";

import {
  listPlayerResults,
  listPlayers,
  resolvePlayerResultsTotal,
  resolvePlayersTotal,
  updatePlayer,
} from "./players";

test("listPlayers reads data and meta from the backend envelope", async () => {
  const originalFetch = globalThis.fetch;
  let requestUrl = "";

  globalThis.fetch = (async (input) => {
    requestUrl = String(input);

    return {
      ok: true,
      text: async () =>
        JSON.stringify({
          data: [
            {
              playerId: "player-777",
              playerName: "Olga Smirnova",
              division: "FPO",
              rdga: null,
              rdgaSince: "2026-02-10",
              seasonDivision: "FPO",
              seasonPoints: 88.4,
              seasonCreditPoints: 74.2,
              competitionsCount: 4,
            },
          ],
          meta: {
            count: 1,
          },
        }),
    } as Response;
  }) as typeof globalThis.fetch;

  try {
    const envelope = await listPlayers({ seasonCode: "2026" });

    assert.match(requestUrl, /\/players\?seasonCode=2026$/);
    assert.equal(envelope.meta?.count, 1);
    assert.equal(envelope.data[0]?.playerId, "player-777");
    assert.equal(envelope.data[0]?.division, "FPO");
    assert.equal(envelope.data[0]?.rdga, null);
    assert.equal(envelope.data[0]?.rdgaSince, "2026-02-10");
    assert.equal(envelope.data[0]?.seasonDivision, "FPO");
    assert.equal(envelope.data[0]?.seasonPoints, 88.4);
    assert.equal(envelope.data[0]?.seasonCreditPoints, 74.2);
    assert.equal(envelope.data[0]?.competitionsCount, 4);
    assert.equal(resolvePlayersTotal(envelope.data, envelope.meta), 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("updatePlayer sends player field updates to the backend", async () => {
  const originalFetch = globalThis.fetch;
  let requestInit: RequestInit | undefined;

  globalThis.fetch = (async (_, init) => {
    requestInit = init;

    return {
      ok: true,
      text: async () =>
        JSON.stringify({
          data: {
            playerId: "player-777",
            playerName: "Olga Smirnova",
            division: "FA1",
            rdga: true,
            rdgaSince: "2026-03-01",
            seasonDivision: "FA1",
            competitionsCount: 4,
          },
        }),
    } as Response;
  }) as typeof globalThis.fetch;

  try {
    const player = await updatePlayer({
      playerId: "player-777",
      division: "FA1",
      rdga: true,
      rdgaSince: "2026-03-01",
      seasonDivision: "FA1",
    });

    assert.equal(requestInit?.method, "PUT");
    assert.equal(
      requestInit?.body,
      JSON.stringify({
        playerId: "player-777",
        division: "FA1",
        rdga: true,
        rdgaSince: "2026-03-01",
        seasonDivision: "FA1",
      }),
    );
    assert.equal(player.division, "FA1");
    assert.equal(player.rdga, true);
    assert.equal(player.rdgaSince, "2026-03-01");
    assert.equal(player.seasonDivision, "FA1");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("listPlayerResults reads data and query filters from the backend envelope", async () => {
  const originalFetch = globalThis.fetch;
  let requestPathname = "";
  let requestPlayerId = "";
  let requestSeasonCode = "";
  let requestDateFrom = "";
  let requestDateTo = "";

  globalThis.fetch = (async (input) => {
    const parsedUrl = new URL(String(input));
    requestPathname = parsedUrl.pathname;
    requestPlayerId = parsedUrl.searchParams.get("playerId") ?? "";
    requestSeasonCode = parsedUrl.searchParams.get("seasonCode") ?? "";
    requestDateFrom = parsedUrl.searchParams.get("dateFrom") ?? "";
    requestDateTo = parsedUrl.searchParams.get("dateTo") ?? "";

    return {
      ok: true,
      text: async () =>
        JSON.stringify({
          data: [
            {
              competitionId: "competition-500",
              competitionName: "Spring Cup",
              competitionDate: "2026-04-01",
              category: "A",
              placement: 2,
              sum: 54,
              dnf: false,
              seasonPoints: 43.5,
            },
          ],
          meta: {
            count: 1,
          },
        }),
    } as Response;
  }) as typeof globalThis.fetch;

  try {
    const envelope = await listPlayerResults({
      playerId: "player-777",
      seasonCode: "2026",
      dateFrom: "2026-01-01",
      dateTo: "2026-12-31",
    });

    assert.equal(requestPathname, "/players/results");
    assert.equal(requestPlayerId, "player-777");
    assert.equal(requestSeasonCode, "2026");
    assert.equal(requestDateFrom, "2026-01-01");
    assert.equal(requestDateTo, "2026-12-31");
    assert.equal(envelope.data[0]?.placement, 2);
    assert.equal(resolvePlayerResultsTotal(envelope.data, envelope.meta), 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
