import assert from "node:assert/strict";
import test from "node:test";

import {
  listCompetitions,
  resolveCompetitionsTotal,
  updateCompetitionCategory,
} from "./competitions";

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
              categoryId: "category-501",
              comment: "Не удалось получить результаты соревнования.",
              recordType: "league",
              playersCount: 24,
              metrixId: "metrix-501",
              hasResults: true,
              seasonPoints: 143.75,
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
    assert.equal(envelope.data[0]?.categoryId, "category-501");
    assert.equal(
      envelope.data[0]?.comment,
      "Не удалось получить результаты соревнования.",
    );
    assert.equal(envelope.data[0]?.hasResults, true);
    assert.equal(envelope.data[0]?.seasonPoints, 143.75);
    assert.equal(resolveCompetitionsTotal(envelope.data, envelope.meta), 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("updateCompetitionCategory sends payload to the backend", async () => {
  const originalFetch = globalThis.fetch;
  let requestInit: RequestInit | undefined;

  globalThis.fetch = (async (_input, init) => {
    requestInit = init;

    return {
      ok: true,
      text: async () =>
        JSON.stringify({
          data: {
            competitionId: "competition-501",
            competitionName: "Moscow Snow Cup",
            competitionDate: "2026-01-15",
            courseName: "Luzhniki",
            categoryId: "category-777",
            comment: "Не удалось сохранить результаты соревнования.",
            recordType: "league",
            playersCount: 24,
            metrixId: "metrix-501",
            hasResults: true,
            seasonPoints: 143.75,
          },
        }),
    } as Response;
  }) as typeof globalThis.fetch;

  try {
    const competition = await updateCompetitionCategory({
      competitionId: "competition-501",
      categoryId: "category-777",
    });

    assert.equal(requestInit?.method, "PUT");
    assert.equal(
      requestInit?.body,
      JSON.stringify({
        competitionId: "competition-501",
        categoryId: "category-777",
      }),
    );
    assert.equal(competition.categoryId, "category-777");
    assert.equal(
      competition.comment,
      "Не удалось сохранить результаты соревнования.",
    );
    assert.equal(competition.hasResults, true);
    assert.equal(competition.seasonPoints, 143.75);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
