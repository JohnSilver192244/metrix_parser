import assert from "node:assert/strict";
import test from "node:test";

import {
  createSeasonPointsEntry,
  deleteSeasonPointsEntry,
  listSeasonPointsTable,
  resolveSeasonPointsTableTotal,
  updateSeasonPointsEntry,
} from "./season-points-table";

test("listSeasonPointsTable reads data and query filters from backend envelope", async () => {
  const originalFetch = globalThis.fetch;
  let requestPathname = "";
  let requestSeasonCode: string | null = null;
  let requestPlayersCount: string | null = null;

  globalThis.fetch = (async (input) => {
    const parsedUrl = new URL(String(input));
    requestPathname = parsedUrl.pathname;
    requestSeasonCode = parsedUrl.searchParams.get("seasonCode");
    requestPlayersCount = parsedUrl.searchParams.get("playersCount");

    return {
      ok: true,
      text: async () =>
        JSON.stringify({
          data: [
            {
              seasonCode: "2026",
              playersCount: 32,
              placement: 1,
              points: 75,
            },
          ],
          meta: {
            count: 1,
          },
        }),
    } as Response;
  }) as typeof globalThis.fetch;

  try {
    const envelope = await listSeasonPointsTable({
      seasonCode: "2026",
      playersCount: 32,
    });

    assert.equal(requestPathname, "/season-points-table");
    assert.equal(requestSeasonCode, "2026");
    assert.equal(requestPlayersCount, "32");
    assert.equal(envelope.data[0]?.placement, 1);
    assert.equal(resolveSeasonPointsTableTotal(envelope.data, envelope.meta), 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("createSeasonPointsEntry sends payload to backend", async () => {
  const originalFetch = globalThis.fetch;
  let requestInit: RequestInit | undefined;

  globalThis.fetch = (async (_, init) => {
    requestInit = init;

    return {
      ok: true,
      text: async () =>
        JSON.stringify({
          data: {
            seasonCode: "2026",
            playersCount: 18,
            placement: 4,
            points: 41.5,
          },
        }),
    } as Response;
  }) as typeof globalThis.fetch;

  try {
    const entry = await createSeasonPointsEntry({
      seasonCode: "2026",
      playersCount: 18,
      placement: 4,
      points: 41.5,
    });

    assert.equal(requestInit?.method, "POST");
    assert.equal(
      requestInit?.body,
      JSON.stringify({
        seasonCode: "2026",
        playersCount: 18,
        placement: 4,
        points: 41.5,
      }),
    );
    assert.equal(entry.points, 41.5);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("updateSeasonPointsEntry sends payload to backend", async () => {
  const originalFetch = globalThis.fetch;
  let requestInit: RequestInit | undefined;

  globalThis.fetch = (async (_, init) => {
    requestInit = init;

    return {
      ok: true,
      text: async () =>
        JSON.stringify({
          data: {
            seasonCode: "2026",
            playersCount: 18,
            placement: 4,
            points: 42.25,
          },
        }),
    } as Response;
  }) as typeof globalThis.fetch;

  try {
    const entry = await updateSeasonPointsEntry({
      seasonCode: "2026",
      playersCount: 18,
      placement: 4,
      points: 42.25,
    });

    assert.equal(requestInit?.method, "PUT");
    assert.equal(
      requestInit?.body,
      JSON.stringify({
        seasonCode: "2026",
        playersCount: 18,
        placement: 4,
        points: 42.25,
      }),
    );
    assert.equal(entry.points, 42.25);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("deleteSeasonPointsEntry sends delete request with composite key", async () => {
  const originalFetch = globalThis.fetch;
  let requestInit: RequestInit | undefined;

  globalThis.fetch = (async (_, init) => {
    requestInit = init;

    return {
      ok: true,
      text: async () => JSON.stringify({ data: null }),
    } as Response;
  }) as typeof globalThis.fetch;

  try {
    await deleteSeasonPointsEntry({
      seasonCode: "2026",
      playersCount: 18,
      placement: 4,
    });

    assert.equal(requestInit?.method, "DELETE");
    assert.equal(
      requestInit?.body,
      JSON.stringify({
        seasonCode: "2026",
        playersCount: 18,
        placement: 4,
      }),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
