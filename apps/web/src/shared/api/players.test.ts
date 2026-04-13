import assert from "node:assert/strict";
import test from "node:test";

import {
  getPlayer,
  listPlayerResults,
  listPlayers,
  resolvePlayerResultsTotal,
  resolvePlayersTotal,
  updatePlayer,
} from "./players";

test("listPlayers reads data and meta from the backend envelope", async () => {
  const originalFetch = globalThis.fetch;
  let requestPathname = "";
  let requestSeasonCode = "";
  let requestLimit = "";
  let requestOffset = "";

  globalThis.fetch = (async (input) => {
    const parsedUrl = new URL(String(input));
    requestPathname = parsedUrl.pathname;
    requestSeasonCode = parsedUrl.searchParams.get("seasonCode") ?? "";
    requestLimit = parsedUrl.searchParams.get("limit") ?? "";
    requestOffset = parsedUrl.searchParams.get("offset") ?? "";

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

    assert.equal(requestPathname, "/players");
    assert.equal(requestSeasonCode, "2026");
    assert.equal(requestLimit, "1000");
    assert.equal(requestOffset, "0");
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

test("listPlayers loads all pages and returns merged meta count", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;

  globalThis.fetch = (async (input) => {
    const parsedUrl = new URL(String(input));
    const offset = Number(parsedUrl.searchParams.get("offset") ?? "0");
    calls += 1;

    const pageSize = offset === 0 ? 1000 : 3;
    const data = Array.from({ length: pageSize }, (_, index) => ({
      playerId: `player-${offset + index + 1}`,
      playerName: `Player ${offset + index + 1}`,
      division: "MPO",
      rdga: null,
      rdgaSince: null,
      seasonDivision: null,
      seasonPoints: null,
      seasonCreditPoints: null,
      competitionsCount: 0,
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
    const envelope = await listPlayers();

    assert.equal(calls, 2);
    assert.equal(envelope.data.length, 1003);
    assert.equal(envelope.meta?.count, 1003);
    assert.equal(envelope.data[1002]?.playerId, "player-1003");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("getPlayer reads a single player by id", async () => {
  const originalFetch = globalThis.fetch;
  let requestPathname = "";

  globalThis.fetch = (async (input) => {
    requestPathname = new URL(String(input)).pathname;

    return {
      ok: true,
      text: async () =>
        JSON.stringify({
          data: {
            playerId: "player-888",
            playerName: "Alex Petrov",
            division: "MPO",
            rdga: true,
            rdgaSince: "2026-01-01",
            seasonDivision: "MPO",
            seasonPoints: null,
            seasonCreditPoints: null,
            competitionsCount: 7,
          },
        }),
    } as Response;
  }) as typeof globalThis.fetch;

  try {
    const player = await getPlayer("player-888");

    assert.equal(requestPathname, "/players/player-888");
    assert.equal(player.playerId, "player-888");
    assert.equal(player.playerName, "Alex Petrov");
    assert.equal(player.competitionsCount, 7);
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
  let requestLimit = "";
  let requestOffset = "";

  globalThis.fetch = (async (input) => {
    const parsedUrl = new URL(String(input));
    requestPathname = parsedUrl.pathname;
    requestPlayerId = parsedUrl.searchParams.get("playerId") ?? "";
    requestSeasonCode = parsedUrl.searchParams.get("seasonCode") ?? "";
    requestDateFrom = parsedUrl.searchParams.get("dateFrom") ?? "";
    requestDateTo = parsedUrl.searchParams.get("dateTo") ?? "";
    requestLimit = parsedUrl.searchParams.get("limit") ?? "";
    requestOffset = parsedUrl.searchParams.get("offset") ?? "";

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
    assert.equal(requestLimit, "1000");
    assert.equal(requestOffset, "0");
    assert.equal(envelope.data[0]?.placement, 2);
    assert.equal(resolvePlayerResultsTotal(envelope.data, envelope.meta), 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("listPlayerResults loads all pages and returns merged meta count", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;

  globalThis.fetch = (async (input) => {
    const parsedUrl = new URL(String(input));
    const offset = Number(parsedUrl.searchParams.get("offset") ?? "0");
    calls += 1;

    const pageSize = offset === 0 ? 1000 : 1;
    const data = Array.from({ length: pageSize }, (_, index) => ({
      competitionId: `competition-${offset + index + 1}`,
      competitionName: `Competition ${offset + index + 1}`,
      competitionDate: "2026-04-01",
      category: "A",
      placement: 1,
      sum: 54,
      dnf: false,
      seasonPoints: 50,
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
    const envelope = await listPlayerResults({
      playerId: "player-777",
    });

    assert.equal(calls, 2);
    assert.equal(envelope.data.length, 1001);
    assert.equal(envelope.meta?.count, 1001);
    assert.equal(envelope.data[1000]?.competitionId, "competition-1001");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
