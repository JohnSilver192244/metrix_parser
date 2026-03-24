import assert from "node:assert/strict";
import test from "node:test";

import { listPlayers, resolvePlayersTotal, updatePlayer } from "./players";

test("listPlayers reads data and meta from the backend envelope", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    ({
      ok: true,
      text: async () =>
        JSON.stringify({
          data: [
            {
              playerId: "player-777",
              playerName: "Olga Smirnova",
              division: "FPO",
              rdga: null,
              competitionsCount: 4,
            },
          ],
          meta: {
            count: 1,
          },
        }),
    }) as Response) as typeof globalThis.fetch;

  try {
    const envelope = await listPlayers();

    assert.equal(envelope.meta?.count, 1);
    assert.equal(envelope.data[0]?.playerId, "player-777");
    assert.equal(envelope.data[0]?.division, "FPO");
    assert.equal(envelope.data[0]?.rdga, null);
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
    });

    assert.equal(requestInit?.method, "PUT");
    assert.equal(
      requestInit?.body,
      JSON.stringify({ playerId: "player-777", division: "FA1", rdga: true }),
    );
    assert.equal(player.division, "FA1");
    assert.equal(player.rdga, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
