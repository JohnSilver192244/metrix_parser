import assert from "node:assert/strict";
import test from "node:test";

import {
  getCompetitionContext,
  listCompetitions,
  resolveCompetitionsTotal,
  updateCompetitionCategory,
} from "./competitions";

test("listCompetitions reads data and meta from the backend envelope", async () => {
  const originalFetch = globalThis.fetch;
  let requestPath = "";

  globalThis.fetch = (async (input) => {
    requestPath = new URL(String(input)).pathname + new URL(String(input)).search;

    return {
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
    } as Response;
  }) as typeof globalThis.fetch;

  try {
    const envelope = await listCompetitions();

    assert.equal(requestPath, "/competitions?limit=1000&offset=0");
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

test("listCompetitions loads all pages and returns merged meta count", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;

  globalThis.fetch = (async (input) => {
    const parsedUrl = new URL(String(input));
    const offset = Number(parsedUrl.searchParams.get("offset") ?? "0");
    calls += 1;

    const pageSize = offset === 0 ? 1000 : 2;
    const data = Array.from({ length: pageSize }, (_, index) => ({
      competitionId: `competition-${offset + index + 1}`,
      competitionName: `Competition ${offset + index + 1}`,
      competitionDate: "2026-01-15",
      courseName: null,
      categoryId: null,
      comment: null,
      recordType: null,
      playersCount: 0,
      metrixId: null,
      hasResults: false,
      seasonPoints: null,
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
    const envelope = await listCompetitions();

    assert.equal(calls, 2);
    assert.equal(envelope.data.length, 1002);
    assert.equal(envelope.meta?.count, 1002);
    assert.equal(envelope.data[1001]?.competitionId, "competition-1002");
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

test("getCompetitionContext reads context for a single competition", async () => {
  const originalFetch = globalThis.fetch;
  let requestPathname = "";

  globalThis.fetch = (async (input) => {
    requestPathname = new URL(String(input)).pathname;

    return {
      ok: true,
      text: async () =>
        JSON.stringify({
          data: {
            competition: {
              competitionId: "competition-900",
              competitionName: "April Open",
              competitionDate: "2026-04-20",
              courseId: "course-1",
              courseName: null,
              categoryId: "cat-1",
              recordType: "2",
              playersCount: 18,
              metrixId: null,
            },
            hierarchy: [
              {
                competitionId: "competition-900",
                competitionName: "April Open",
                competitionDate: "2026-04-20",
                courseId: "course-1",
                courseName: null,
                categoryId: "cat-1",
                recordType: "2",
                playersCount: 18,
                metrixId: null,
              },
            ],
            courseNamesById: {
              "course-1": "Main Park",
            },
            categoryNamesById: {
              "cat-1": "A",
            },
            resultCompetitionIds: ["competition-900"],
          },
        }),
    } as Response;
  }) as typeof globalThis.fetch;

  try {
    const context = await getCompetitionContext("competition-900");

    assert.equal(requestPathname, "/competitions/competition-900/context");
    assert.equal(context.competition.competitionId, "competition-900");
    assert.equal(context.courseNamesById["course-1"], "Main Park");
    assert.deepEqual(context.resultCompetitionIds, ["competition-900"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("updateCompetitionCategory invalidates competition context cache", async () => {
  const originalFetch = globalThis.fetch;
  let contextCalls = 0;

  globalThis.fetch = (async (input) => {
    const parsedUrl = new URL(String(input));
    if (parsedUrl.pathname === "/competitions/category") {
      return {
        ok: true,
        text: async () =>
          JSON.stringify({
            data: {
              competitionId: "competition-910",
              competitionName: "April Open",
              competitionDate: "2026-04-20",
              courseId: "course-1",
              courseName: null,
              categoryId: "cat-2",
              recordType: "2",
              playersCount: 18,
              metrixId: null,
            },
          }),
      } as Response;
    }

    if (parsedUrl.pathname === "/competitions/competition-910/context") {
      contextCalls += 1;
      return {
        ok: true,
        text: async () =>
          JSON.stringify({
            data: {
              competition: {
                competitionId: "competition-910",
                competitionName: "April Open",
                competitionDate: "2026-04-20",
                courseId: "course-1",
                courseName: null,
                categoryId: contextCalls === 1 ? "cat-1" : "cat-2",
                recordType: "2",
                playersCount: 18,
                metrixId: null,
              },
              hierarchy: [],
              courseNamesById: {},
              categoryNamesById: {},
              resultCompetitionIds: ["competition-910"],
            },
          }),
      } as Response;
    }

    throw new Error(`Unexpected path: ${parsedUrl.pathname}`);
  }) as typeof globalThis.fetch;

  try {
    const initialContext = await getCompetitionContext("competition-910");
    const cachedContext = await getCompetitionContext("competition-910");
    assert.equal(initialContext.competition.categoryId, "cat-1");
    assert.equal(cachedContext.competition.categoryId, "cat-1");
    assert.equal(contextCalls, 1);

    await updateCompetitionCategory({
      competitionId: "competition-910",
      categoryId: "cat-2",
    });

    const refreshedContext = await getCompetitionContext("competition-910");
    assert.equal(refreshedContext.competition.categoryId, "cat-2");
    assert.equal(contextCalls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
