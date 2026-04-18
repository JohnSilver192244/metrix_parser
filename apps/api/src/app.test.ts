import assert from "node:assert/strict";
import test from "node:test";
import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";
import { gunzipSync } from "node:zlib";

import { createApiRequestHandler } from "./app";
import { HttpError } from "./lib/http-errors";
import { createRouter, type RouteDefinition } from "./lib/router";
import type { ApiModuleDependencies } from "./modules";
import {
  aggregateSeasonStandingsByCompetition,
  loadPaginatedSeasonStandingsRows,
  resolveLegacyFallbackCompetitionSelectColumns,
  resolveCompetitionSeasonPointsByCompetitionId,
  resolveCompetitionIdsWithResultsIncludingDescendants,
} from "./modules/competitions";
import {
  aggregateSeasonStandingsByPlayer,
  buildPlacementByOwnerCompetitionAndPlayerId,
  pickOwnerCompetitionResultRows,
} from "./modules/players";
import {
  resolveCanonicalSeasonCodeByCompetition,
  resolveSeasonPointsByResultIdentity,
  resolveSeasonPointsCompetitionIdForResult,
} from "./modules/results";
import {
  buildSeasonScoringCompetitionUnits,
  loadPaginatedCompetitionResults,
  loadPaginatedSeasonPointsMatrix,
  rankCompetitionResultsForSeasonPoints,
  runSeasonPointsAccrual,
} from "./modules/season-standings";

interface RequestOptions {
  method?: string;
  body?: string;
  headers?: Record<string, string>;
}

async function invokeRequest(
  path: string,
  options: RequestOptions = {},
  dependencies?: ApiModuleDependencies,
) {
  const handler = createApiRequestHandler(dependencies);
  const headers = new Map<string, string>();
  let body = "";
  const requestBody = options.body ?? "";

  const req = Readable.from(requestBody ? [requestBody] : []) as IncomingMessage;
  Object.assign(req, {
    method: options.method ?? "GET",
    url: path,
    headers: {
      host: "localhost",
      ...(options.headers ?? {}),
    },
  });

  const res = {
    statusCode: 200,
    setHeader(name: string, value: string) {
      headers.set(name, value);
    },
    end(chunk?: string) {
      body = chunk ?? "";
    },
  } as unknown as ServerResponse;

  await handler(req, res);

  return {
    statusCode: res.statusCode,
    headers,
    body,
  };
}

async function invokeRequestWithHandler(
  handler: ReturnType<typeof createApiRequestHandler>,
  path: string,
  options: RequestOptions = {},
) {
  const headers = new Map<string, string>();
  let body = "";
  const requestBody = options.body ?? "";

  const req = Readable.from(requestBody ? [requestBody] : []) as IncomingMessage;
  Object.assign(req, {
    method: options.method ?? "GET",
    url: path,
    headers: {
      host: "localhost",
      ...(options.headers ?? {}),
    },
  });

  const res = {
    statusCode: 200,
    setHeader(name: string, value: string) {
      headers.set(name, value);
    },
    end(chunk?: string) {
      body = chunk ?? "";
    },
  } as unknown as ServerResponse;

  await handler(req, res);

  return {
    statusCode: res.statusCode,
    headers,
    body,
  };
}

test("GET /health returns the success envelope", async () => {
  const response = await invokeRequest("/health");
  const payload = JSON.parse(response.body) as {
    data: { service: string; status: string; timestamp: string };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers.get("Content-Type"), "application/json; charset=utf-8");
  assert.equal(payload.data.service, "api");
  assert.equal(payload.data.status, "ok");
  assert.ok(Date.parse(payload.data.timestamp));
});

test("GET /competitions compresses JSON payload when client accepts gzip", async () => {
  const response = await invokeRequest(
    "/competitions",
    {
      headers: {
        "accept-encoding": "gzip",
      },
    },
    {
      competitions: {
        listCompetitions: async () =>
          Array.from({ length: 120 }, (_, index) => ({
            competitionId: `competition-${index + 1}`,
            competitionName: `Competition ${index + 1}`,
            competitionDate: "2026-04-10",
            parentId: null,
            courseId: null,
            courseName: null,
            categoryId: null,
            comment: null,
            recordType: null,
            playersCount: null,
            metrixId: null,
            hasResults: false,
            seasonPoints: null,
          })),
      },
    },
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers.get("Content-Encoding"), "gzip");

  const decompressed = gunzipSync(Buffer.from(response.body, "binary")).toString("utf8");
  const payload = JSON.parse(decompressed) as { data: unknown[] };
  assert.equal(payload.data.length, 120);
});

test("GET /competitions skips compression on local unified dev host", async () => {
  const handler = createApiRequestHandler({
    competitions: {
      listCompetitions: async () =>
        Array.from({ length: 120 }, (_, index) => ({
          competitionId: `competition-${index + 1}`,
          competitionName: `Competition ${index + 1}`,
          competitionDate: "2026-04-10",
          parentId: null,
          courseId: null,
          courseName: null,
          categoryId: null,
          comment: null,
          recordType: null,
          playersCount: null,
          metrixId: null,
          hasResults: false,
          seasonPoints: null,
        })),
    },
  });
  const response = await invokeRequestWithHandler(handler, "/competitions", {
    headers: {
      host: "localhost:5173",
      "accept-encoding": "gzip",
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers.get("Content-Encoding"), undefined);

  const payload = JSON.parse(response.body) as { data: unknown[] };
  assert.equal(payload.data.length, 120);
});

test("GET /health/performance returns performance snapshot envelope", async () => {
  const response = await invokeRequest("/health/performance");
  const payload = JSON.parse(response.body) as {
    data: {
      capturedAt: string;
      requests: { endpointTop10ByP95: unknown[] };
      sql: { top10ByP95: unknown[]; totalCalls: number };
      cache: {
        hitCount: number;
        missCount: number;
        evictionCount: number;
        getLatencyMs: { avg: number; p95: number };
      };
    };
  };

  assert.equal(response.statusCode, 200);
  assert.ok(Date.parse(payload.data.capturedAt));
  assert.ok(Array.isArray(payload.data.requests.endpointTop10ByP95));
  assert.ok(Array.isArray(payload.data.sql.top10ByP95));
  assert.equal(typeof payload.data.sql.totalCalls, "number");
  assert.equal(typeof payload.data.cache.hitCount, "number");
  assert.equal(typeof payload.data.cache.missCount, "number");
  assert.equal(typeof payload.data.cache.evictionCount, "number");
  assert.equal(typeof payload.data.cache.getLatencyMs.avg, "number");
  assert.equal(typeof payload.data.cache.getLatencyMs.p95, "number");
});

test("POST /health/performance/reset clears in-memory metrics", async () => {
  const response = await invokeRequest("/health/performance/reset", {
    method: "POST",
  });
  const payload = JSON.parse(response.body) as {
    data: { status: string };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(payload.data.status, "reset");
});

test("OPTIONS requests expose CORS headers for authorization", async () => {
  const response = await invokeRequest("/players", {
    method: "OPTIONS",
  });

  assert.equal(response.statusCode, 204);
  assert.equal(
    response.headers.get("Access-Control-Allow-Headers"),
    "Content-Type, Authorization",
  );
  assert.equal(
    response.headers.get("Access-Control-Allow-Methods"),
    "GET,POST,PUT,DELETE,OPTIONS",
  );
});

test("GET /competitions returns persisted competitions via the API envelope", async () => {
  const response = await invokeRequest(
    "/competitions",
    {},
    {
      competitions: {
        listCompetitions: async () => [
          {
            competitionId: "competition-102",
            competitionName: "Moscow Spring Open",
            competitionDate: "2026-04-21",
            parentId: "series-10",
            courseId: "course-200",
            courseName: "Troparevo",
            categoryId: "category-pro",
            comment: "Не удалось получить результаты соревнования.",
            recordType: "tournament",
            playersCount: 48,
            metrixId: "metrix-102",
            hasResults: true,
            seasonPoints: 186.4,
          },
          {
            competitionId: "competition-101",
            competitionName: "Saint Petersburg Cup",
            competitionDate: "2026-04-14",
            parentId: null,
            courseId: null,
            courseName: null,
            categoryId: null,
            recordType: null,
            playersCount: null,
            metrixId: null,
            hasResults: false,
            seasonPoints: null,
          },
        ],
      },
    },
  );
  const payload = JSON.parse(response.body) as {
    data: Array<{
      competitionId: string;
      competitionName: string;
      competitionDate: string;
      parentId?: string | null;
      courseId?: string | null;
      courseName: string | null;
      categoryId?: string | null;
      comment?: string | null;
      recordType: string | null;
      playersCount: number | null;
      metrixId: string | null;
      hasResults?: boolean;
      seasonPoints?: number | null;
    }>;
    meta: {
      count: number;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(payload.meta.count, 2);
  assert.deepEqual(payload.data[0], {
    competitionId: "competition-102",
    competitionName: "Moscow Spring Open",
    competitionDate: "2026-04-21",
    parentId: "series-10",
    courseId: "course-200",
    courseName: "Troparevo",
    categoryId: "category-pro",
    comment: "Не удалось получить результаты соревнования.",
    recordType: "tournament",
    playersCount: 48,
    metrixId: "metrix-102",
    hasResults: true,
    seasonPoints: 186.4,
  });
  assert.deepEqual(payload.data[1], {
    competitionId: "competition-101",
    competitionName: "Saint Petersburg Cup",
    competitionDate: "2026-04-14",
    parentId: null,
    courseId: null,
    courseName: null,
    categoryId: null,
    recordType: null,
    playersCount: null,
    metrixId: null,
    hasResults: false,
    seasonPoints: null,
  });
});

test("GET /competitions/:id/context returns competition context envelope", async () => {
  const response = await invokeRequest(
    "/competitions/competition-102/context",
    {},
    {
      competitions: {
        getCompetitionContext: async (competitionId) => {
          assert.equal(competitionId, "competition-102");
          return {
            competition: {
              competitionId: "competition-102",
              competitionName: "Moscow Spring Open",
              competitionDate: "2026-04-21",
              courseId: "course-200",
              courseName: null,
              categoryId: "category-pro",
              recordType: "2",
              playersCount: 48,
              metrixId: "metrix-102",
            },
            hierarchy: [
              {
                competitionId: "competition-102",
                competitionName: "Moscow Spring Open",
                competitionDate: "2026-04-21",
                courseId: "course-200",
                courseName: null,
                categoryId: "category-pro",
                recordType: "2",
                playersCount: 48,
                metrixId: "metrix-102",
              },
            ],
            courseNamesById: {
              "course-200": "Troparevo",
            },
            categoryNamesById: {
              "category-pro": "Pro",
            },
            resultCompetitionIds: ["competition-102"],
          };
        },
      },
    },
  );

  const payload = JSON.parse(response.body) as {
    data: {
      competition: { competitionId: string };
      resultCompetitionIds: string[];
      courseNamesById: Record<string, string>;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(payload.data.competition.competitionId, "competition-102");
  assert.deepEqual(payload.data.resultCompetitionIds, ["competition-102"]);
  assert.equal(payload.data.courseNamesById["course-200"], "Troparevo");
});

test("PUT /competitions/category updates competition category for authenticated user", async () => {
  let receivedPayload: { competitionId: string; categoryId: string | null } | null = null;

  const response = await invokeRequest(
    "/competitions/category",
    {
      method: "PUT",
      headers: {
        authorization: "Bearer session-100",
      },
      body: JSON.stringify({
        competitionId: "competition-777",
        categoryId: "category-200",
      }),
    },
    {
      auth: {
        requireAuthenticatedUser: async (sessionToken) => {
          assert.equal(sessionToken, "session-100");

          return {
            login: "admin",
          };
        },
      },
      competitions: {
        updateCompetitionCategory: async (payload) => {
          receivedPayload = payload;

          return {
            competitionId: "competition-777",
            competitionName: "Updated Event",
            competitionDate: "2026-05-12",
            courseId: null,
            courseName: null,
            categoryId: "category-200",
            comment: "Не удалось сохранить результаты соревнования.",
            recordType: "4",
            playersCount: 32,
            metrixId: null,
            hasResults: true,
          };
        },
      },
    },
  );

  const payload = JSON.parse(response.body) as {
    data: {
      competitionId: string;
      categoryId: string | null;
      comment?: string | null;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.deepEqual(receivedPayload, {
    competitionId: "competition-777",
    categoryId: "category-200",
  });
  assert.equal(payload.data.competitionId, "competition-777");
  assert.equal(payload.data.categoryId, "category-200");
  assert.equal(
    payload.data.comment,
    "Не удалось сохранить результаты соревнования.",
  );
});

test("PUT /competitions/category writes a manual category comment on failure", async () => {
  let updatedComment:
    | {
        competitionId: string;
        comment: string | null;
      }
    | undefined;

  const response = await invokeRequest(
    "/competitions/category",
    {
      method: "PUT",
      headers: {
        authorization: "Bearer session-101",
      },
      body: JSON.stringify({
        competitionId: "competition-778",
        categoryId: "category-201",
      }),
    },
    {
      auth: {
        requireAuthenticatedUser: async () => ({ login: "admin" }),
      },
      competitions: {
        updateCompetitionCategory: async () => {
          throw new Error("write failed");
        },
        getCompetitionComment: async () => null,
        updateCompetitionComment: async (competitionId, comment) => {
          updatedComment = {
            competitionId,
            comment,
          };
        },
      },
    },
  );

  assert.equal(response.statusCode, 500);
  assert.deepEqual(updatedComment, {
    competitionId: "competition-778",
    comment: "Не удалось сохранить категорию соревнования.",
  });
});

test("PUT /competitions/category clears a manual category comment after a successful update", async () => {
  let updatedComment:
    | {
        competitionId: string;
        comment: string | null;
      }
    | undefined;

  const response = await invokeRequest(
    "/competitions/category",
    {
      method: "PUT",
      headers: {
        authorization: "Bearer session-102",
      },
      body: JSON.stringify({
        competitionId: "competition-779",
        categoryId: "category-202",
      }),
    },
    {
      auth: {
        requireAuthenticatedUser: async () => ({ login: "admin" }),
      },
      competitions: {
        updateCompetitionCategory: async () => ({
          competitionId: "competition-779",
          competitionName: "Updated Event",
          competitionDate: "2026-05-13",
          courseId: null,
          courseName: null,
          categoryId: "category-202",
          comment: "Не удалось сохранить категорию соревнования.",
          recordType: "4",
          playersCount: 24,
          metrixId: null,
          hasResults: false,
        }),
        updateCompetitionComment: async (competitionId, comment) => {
          updatedComment = {
            competitionId,
            comment,
          };
        },
      },
    },
  );

  const payload = JSON.parse(response.body) as {
    data: {
      competitionId: string;
      comment: string | null;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.deepEqual(updatedComment, {
    competitionId: "competition-779",
    comment: null,
  });
  assert.equal(payload.data.comment, null);
});

test("resolveCompetitionIdsWithResultsIncludingDescendants marks parents when child has results", () => {
  const ids = resolveCompetitionIdsWithResultsIncludingDescendants(
    [
      {
        competition_id: "tour",
        competition_name: "Tour",
        competition_date: "2026-01-01",
        parent_id: null,
        course_id: null,
        course_name: null,
        record_type: "5",
        players_count: null,
        metrix_id: null,
      },
      {
        competition_id: "event",
        competition_name: "Event",
        competition_date: "2026-01-02",
        parent_id: "tour",
        course_id: null,
        course_name: null,
        record_type: "4",
        players_count: null,
        metrix_id: null,
      },
      {
        competition_id: "round",
        competition_name: "Round",
        competition_date: "2026-01-03",
        parent_id: "event",
        course_id: null,
        course_name: null,
        record_type: "1",
        players_count: null,
        metrix_id: null,
      },
      {
        competition_id: "standalone",
        competition_name: "Standalone",
        competition_date: "2026-01-04",
        parent_id: null,
        course_id: null,
        course_name: null,
        record_type: "4",
        players_count: null,
        metrix_id: null,
      },
    ],
    new Set(["round"]),
  );

  assert.deepEqual(Array.from(ids).sort(), ["event", "round", "tour"]);
  assert.equal(ids.has("standalone"), false);
});

test("GET /courses returns persisted parks via the API envelope", async () => {
  const response = await invokeRequest(
    "/courses",
    {},
    {
      courses: {
        listCourses: async () => [
          {
            courseId: "course-200",
            name: "Moscow Park",
            fullname: "Moscow Disc Golf Park",
            type: "18 holes",
            countryCode: "RU",
            area: "Moscow",
            ratingValue1: 4.8,
            ratingResult1: 15,
            ratingValue2: 4.6,
            ratingResult2: 10,
            coursePar: 61,
            basketsCount: 18,
          },
          {
            courseId: "course-201",
            name: "Kazan Park",
            fullname: null,
            type: null,
            countryCode: null,
            area: null,
            ratingValue1: null,
            ratingResult1: null,
            ratingValue2: null,
            ratingResult2: null,
            coursePar: 54,
            basketsCount: 12,
          },
        ],
      },
    },
  );
  const payload = JSON.parse(response.body) as {
    data: Array<{
      courseId: string;
      name: string;
      fullname: string | null;
      type: string | null;
      countryCode: string | null;
      area: string | null;
      ratingValue1: number | null;
      ratingResult1: number | null;
      ratingValue2: number | null;
      ratingResult2: number | null;
      coursePar: number;
      basketsCount: number;
    }>;
    meta: {
      count: number;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(payload.meta.count, 2);
  assert.deepEqual(payload.data[0], {
    courseId: "course-200",
    name: "Moscow Park",
    fullname: "Moscow Disc Golf Park",
    type: "18 holes",
    countryCode: "RU",
    area: "Moscow",
    ratingValue1: 4.8,
    ratingResult1: 15,
    ratingValue2: 4.6,
    ratingResult2: 10,
    coursePar: 61,
    basketsCount: 18,
  });
  assert.deepEqual(payload.data[1], {
    courseId: "course-201",
    name: "Kazan Park",
    fullname: null,
    type: null,
    countryCode: null,
    area: null,
    ratingValue1: null,
    ratingResult1: null,
    ratingValue2: null,
    ratingResult2: null,
    coursePar: 54,
    basketsCount: 12,
  });
});

test("GET /courses applies limit/offset pagination defaults from query", async () => {
  const response = await invokeRequest(
    "/courses?limit=1&offset=1",
    {},
    {
      courses: {
        listCourses: async () => [
          {
            courseId: "course-1",
            name: "Alpha",
            fullname: "Alpha Full",
            type: "park",
            countryCode: "RU",
            area: "Moscow",
            ratingValue1: null,
            ratingResult1: null,
            ratingValue2: null,
            ratingResult2: null,
            coursePar: 54,
            basketsCount: null,
          },
          {
            courseId: "course-2",
            name: "Beta",
            fullname: "Beta Full",
            type: "park",
            countryCode: "RU",
            area: "Moscow",
            ratingValue1: null,
            ratingResult1: null,
            ratingValue2: null,
            ratingResult2: null,
            coursePar: 54,
            basketsCount: null,
          },
        ],
      },
    },
  );
  const payload = JSON.parse(response.body) as {
    data: Array<{ courseId: string }>;
    meta: { count: number; limit: number; offset: number };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(payload.meta.count, 1);
  assert.equal(payload.meta.limit, 1);
  assert.equal(payload.meta.offset, 1);
  assert.equal(payload.data[0]?.courseId, "course-2");
});

test("GET /divisions returns reference divisions via the API envelope", async () => {
  const response = await invokeRequest(
    "/divisions",
    {},
    {
      divisions: {
        listDivisions: async () => [
          {
            code: "FPO",
          },
          {
            code: "MPO",
          },
        ],
      },
    },
  );
  const payload = JSON.parse(response.body) as {
    data: Array<{
      code: string;
    }>;
    meta: {
      count: number;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(payload.meta.count, 2);
  assert.deepEqual(payload.data, [{ code: "FPO" }, { code: "MPO" }]);
});

test("POST /divisions creates division for authenticated user", async () => {
  let receivedPayload: { code: string } | undefined;

  const response = await invokeRequest(
    "/divisions",
    {
      method: "POST",
      headers: {
        authorization: "Bearer session-100",
      },
      body: JSON.stringify({
        code: "MA3",
      }),
    },
    {
      divisions: {
        createDivision: async (payload) => {
          receivedPayload = payload;

          return payload;
        },
      },
      auth: {
        requireAuthenticatedUser: async () => ({
          login: "admin",
        }),
      },
    },
  );

  assert.equal(response.statusCode, 201);
  assert.deepEqual(receivedPayload, { code: "MA3" });
  assert.deepEqual(JSON.parse(response.body), {
    data: {
      code: "MA3",
    },
  });
});

test("PUT /divisions updates division code for authenticated user", async () => {
  let receivedPayload:
    | {
        code: string;
        nextCode: string;
      }
    | undefined;

  const response = await invokeRequest(
    "/divisions",
    {
      method: "PUT",
      headers: {
        authorization: "Bearer session-100",
      },
      body: JSON.stringify({
        code: "MP40",
        nextCode: "MP50",
      }),
    },
    {
      divisions: {
        updateDivision: async (payload) => {
          receivedPayload = payload;

          return {
            code: payload.nextCode,
          };
        },
      },
      auth: {
        requireAuthenticatedUser: async () => ({
          login: "admin",
        }),
      },
    },
  );

  assert.equal(response.statusCode, 200);
  assert.deepEqual(receivedPayload, {
    code: "MP40",
    nextCode: "MP50",
  });
  assert.deepEqual(JSON.parse(response.body), {
    data: {
      code: "MP50",
    },
  });
});

test("DELETE /divisions removes division for authenticated user", async () => {
  let receivedCode: string | undefined;

  const response = await invokeRequest(
    "/divisions",
    {
      method: "DELETE",
      headers: {
        authorization: "Bearer session-100",
      },
      body: JSON.stringify({
        code: "MA4",
      }),
    },
    {
      divisions: {
        deleteDivision: async (payload) => {
          receivedCode = payload.code;
        },
      },
      auth: {
        requireAuthenticatedUser: async () => ({
          login: "admin",
        }),
      },
    },
  );

  assert.equal(response.statusCode, 200);
  assert.equal(receivedCode, "MA4");
  assert.deepEqual(JSON.parse(response.body), {
    data: null,
  });
});

test("PUT /divisions rejects guest edits", async () => {
  const response = await invokeRequest(
    "/divisions",
    {
      method: "PUT",
      body: JSON.stringify({
        code: "MP40",
        nextCode: "MP50",
      }),
    },
    {
      auth: {
        requireAuthenticatedUser: async () => {
          throw new HttpError(401, "unauthorized", "Authentication required");
        },
      },
    },
  );

  assert.equal(response.statusCode, 401);
  assert.deepEqual(JSON.parse(response.body), {
    error: {
      code: "unauthorized",
      message: "Authentication required",
    },
  });
});

test("GET /players returns persisted players via the API envelope", async () => {
  const response = await invokeRequest(
    "/players?seasonCode=2026",
    {},
    {
      players: {
        listPlayers: async (filters) => {
          assert.deepEqual(filters, {
            seasonCode: "2026",
          });

          return [
          {
            playerId: "player-100",
            playerName: "Ivan Ivanov",
            division: "MPO",
            rdga: true,
            rdgaSince: "2026-01-15",
            seasonDivision: "MPO",
            seasonPoints: 120.75,
            seasonCreditPoints: 95.5,
            competitionsCount: 3,
          },
          {
            playerId: "player-101",
            playerName: "Anna Petrova",
            division: null,
            rdga: null,
            rdgaSince: null,
            seasonDivision: null,
            seasonPoints: null,
            seasonCreditPoints: null,
            competitionsCount: 1,
          },
          ];
        },
      },
    },
  );
  const payload = JSON.parse(response.body) as {
    data: Array<{
      playerId: string;
      playerName: string;
      division: string | null;
      rdga: boolean | null;
      rdgaSince: string | null;
      seasonDivision: string | null;
      seasonPoints?: number | null;
      seasonCreditPoints?: number | null;
      competitionsCount?: number;
    }>;
    meta: {
      count: number;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(payload.meta.count, 2);
  assert.deepEqual(payload.data[0], {
    playerId: "player-100",
    playerName: "Ivan Ivanov",
    division: "MPO",
    rdga: true,
    rdgaSince: "2026-01-15",
    seasonDivision: "MPO",
    seasonPoints: 120.75,
    seasonCreditPoints: 95.5,
    competitionsCount: 3,
  });
  assert.deepEqual(payload.data[1], {
    playerId: "player-101",
    playerName: "Anna Petrova",
    division: null,
    rdga: null,
    rdgaSince: null,
    seasonDivision: null,
    seasonPoints: null,
    seasonCreditPoints: null,
    competitionsCount: 1,
  });
});

test("GET /players/:id returns one player via the API envelope", async () => {
  const response = await invokeRequest(
    "/players/player-100",
    {},
    {
      players: {
        getPlayer: async (playerId) => {
          assert.equal(playerId, "player-100");
          return {
            playerId: "player-100",
            playerName: "Ivan Ivanov",
            division: "MPO",
            rdga: true,
            rdgaSince: "2026-01-05",
            seasonDivision: "MPO",
            seasonPoints: null,
            seasonCreditPoints: null,
            competitionsCount: 5,
          };
        },
      },
    },
  );

  const payload = JSON.parse(response.body) as {
    data: {
      playerId: string;
      playerName: string;
      competitionsCount: number;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(payload.data.playerId, "player-100");
  assert.equal(payload.data.playerName, "Ivan Ivanov");
  assert.equal(payload.data.competitionsCount, 5);
});

test("GET /players reuses API read cache for equivalent query params", async () => {
  let listPlayersCalls = 0;
  const handler = createApiRequestHandler({
    players: {
      listPlayers: async () => {
        listPlayersCalls += 1;
        return [
          {
            playerId: "player-100",
            playerName: "Ivan Ivanov",
            division: "MPO",
            rdga: true,
            rdgaSince: "2025-01-01",
            seasonDivision: "MPO",
            seasonPoints: 120.5,
            seasonCreditPoints: 90,
            competitionsCount: 8,
          },
        ];
      },
    },
  });

  const firstResponse = await invokeRequestWithHandler(
    handler,
    "/players?seasonCode=2026&limit=50&offset=0",
  );
  const secondResponse = await invokeRequestWithHandler(
    handler,
    "/players?offset=0&limit=50&seasonCode=2026",
  );

  assert.equal(firstResponse.statusCode, 200);
  assert.equal(secondResponse.statusCode, 200);
  assert.equal(listPlayersCalls, 1);
});

test("GET /players/results returns player competition rows with applied filters", async () => {
  const response = await invokeRequest(
    "/players/results?playerId=player-100&seasonCode=2026&dateFrom=2026-01-01&dateTo=2026-12-31",
    {},
    {
      players: {
        listPlayerResults: async (filters) => {
          assert.deepEqual(filters, {
            playerId: "player-100",
            seasonCode: "2026",
            dateFrom: "2026-01-01",
            dateTo: "2026-12-31",
            limit: 200,
            offset: 0,
          });

          return [
            {
              competitionId: "competition-10",
              competitionName: "Spring Cup",
              competitionDate: "2026-04-14",
              category: "A",
              placement: 2,
              sum: 54,
              dnf: false,
              seasonPoints: 43.5,
            },
          ];
        },
      },
    },
  );

  const payload = JSON.parse(response.body) as {
    data: Array<{
      competitionId: string;
      competitionName: string;
      competitionDate: string;
      category: string | null;
      placement: number | null;
      seasonPoints: number | null;
    }>;
    meta: {
      count: number;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(payload.meta.count, 1);
  assert.deepEqual(payload.data[0], {
    competitionId: "competition-10",
    competitionName: "Spring Cup",
    competitionDate: "2026-04-14",
    category: "A",
    placement: 2,
    sum: 54,
    dnf: false,
    seasonPoints: 43.5,
  });
});

test("aggregateSeasonStandingsByPlayer counts unique season competitions per player", () => {
  const aggregated = aggregateSeasonStandingsByPlayer([
    {
      player_id: "player-100",
      competition_id: "competition-1",
      category_id: "category-4",
      placement: 1,
      season_points: 120,
    },
    {
      player_id: "player-100",
      competition_id: "competition-2",
      category_id: "category-2",
      placement: 2,
      season_points: 77,
    },
    {
      player_id: "player-100",
      competition_id: "competition-2",
      category_id: "category-2",
      placement: 3,
      season_points: 0,
    },
    {
      player_id: "player-101",
      competition_id: null,
      category_id: null,
      placement: null,
      season_points: 50,
    },
  ]);

  assert.equal(aggregated.seasonPointsByPlayerId.get("player-100"), 197);
  assert.equal(aggregated.seasonCompetitionCountByPlayerId.get("player-100"), 2);
  assert.equal(aggregated.seasonPointsByPlayerId.get("player-101"), 50);
  assert.equal(aggregated.seasonCompetitionCountByPlayerId.get("player-101"), undefined);
  assert.equal(aggregated.seasonCreditPointsByPlayerId.get("player-100"), undefined);
});

test("aggregateSeasonStandingsByPlayer calculates season credit points by class and season limits", () => {
  const aggregated = aggregateSeasonStandingsByPlayer(
    [
      {
        player_id: "player-100",
        competition_id: "league-1",
        category_id: "category-4",
        placement: 1,
        season_points: 40,
      },
      {
        player_id: "player-100",
        competition_id: "league-2",
        category_id: "category-5",
        placement: 2,
        season_points: 30,
      },
      {
        player_id: "player-100",
        competition_id: "league-3",
        category_id: "category-6",
        placement: 3,
        season_points: 20,
      },
      {
        player_id: "player-100",
        competition_id: "tournament-1",
        category_id: "category-2",
        placement: 4,
        season_points: 50,
      },
      {
        player_id: "player-100",
        competition_id: "tournament-2",
        category_id: "category-3",
        placement: 5,
        season_points: 45,
      },
    ],
    {
      bestLeaguesCount: 2,
      bestTournamentsCount: 1,
      competitionClassByCategoryId: new Map([
        ["category-2", "tournament"],
        ["category-3", "tournament"],
        ["category-4", "league"],
        ["category-5", "league"],
        ["category-6", "league"],
      ]),
    },
    new Map([
      ["league-1", "League One"],
      ["league-2", "League Two"],
      ["league-3", "League Three"],
      ["tournament-1", "Tournament One"],
      ["tournament-2", "Tournament Two"],
    ]),
  );

  assert.equal(aggregated.seasonCreditPointsByPlayerId.get("player-100"), 120);
  assert.deepEqual(aggregated.seasonCreditCompetitionsByPlayerId.get("player-100"), [
    {
      competitionId: "tournament-1",
      competitionName: "Tournament One",
      placement: 4,
      seasonPoints: 50,
    },
    {
      competitionId: "league-1",
      competitionName: "League One",
      placement: 1,
      seasonPoints: 40,
    },
    {
      competitionId: "league-2",
      competitionName: "League Two",
      placement: 2,
      seasonPoints: 30,
    },
  ]);
});

test("pickOwnerCompetitionResultRows collapses rows by owner and prefers owner competition row", () => {
  const selectedRowsByOwnerCompetitionId = pickOwnerCompetitionResultRows([
    {
      sourceCompetitionId: "round-2",
      ownerCompetitionId: "event-1",
      sum: 56,
      dnf: false,
    },
    {
      sourceCompetitionId: "event-1",
      ownerCompetitionId: "event-1",
      sum: 112,
      dnf: false,
    },
    {
      sourceCompetitionId: "round-1",
      ownerCompetitionId: "event-1",
      sum: 55,
      dnf: false,
    },
  ]);

  assert.deepEqual(selectedRowsByOwnerCompetitionId.get("event-1"), {
    sourceCompetitionId: "event-1",
    ownerCompetitionId: "event-1",
    sum: 112,
    dnf: false,
  });
});

test("pickOwnerCompetitionResultRows chooses the best ranked non-DNF row when owner row is absent", () => {
  const selectedRowsByOwnerCompetitionId = pickOwnerCompetitionResultRows([
    {
      sourceCompetitionId: "round-2",
      ownerCompetitionId: "event-2",
      sum: 58,
      dnf: false,
    },
    {
      sourceCompetitionId: "round-1",
      ownerCompetitionId: "event-2",
      sum: 55,
      dnf: false,
    },
    {
      sourceCompetitionId: "round-3",
      ownerCompetitionId: "event-2",
      sum: null,
      dnf: true,
    },
  ]);

  assert.deepEqual(selectedRowsByOwnerCompetitionId.get("event-2"), {
    sourceCompetitionId: "round-1",
    ownerCompetitionId: "event-2",
    sum: 55,
    dnf: false,
  });
});

test("pickOwnerCompetitionResultRows ignores DNF owner row when ranked child row exists", () => {
  const selectedRowsByOwnerCompetitionId = pickOwnerCompetitionResultRows([
    {
      sourceCompetitionId: "event-3",
      ownerCompetitionId: "event-3",
      sum: null,
      dnf: true,
    },
    {
      sourceCompetitionId: "round-3-1",
      ownerCompetitionId: "event-3",
      sum: 54,
      dnf: false,
    },
    {
      sourceCompetitionId: "round-3-2",
      ownerCompetitionId: "event-3",
      sum: 58,
      dnf: false,
    },
  ]);

  assert.deepEqual(selectedRowsByOwnerCompetitionId.get("event-3"), {
    sourceCompetitionId: "round-3-1",
    ownerCompetitionId: "event-3",
    sum: 54,
    dnf: false,
  });
});

test("buildPlacementByOwnerCompetitionAndPlayerId excludes players with DNF in required source rounds", () => {
  const placementByOwnerCompetitionAndPlayerId = buildPlacementByOwnerCompetitionAndPlayerId(
    new Map([
      ["event-3186083", ["round-1", "round-2"]],
    ]),
    [
      {
        competition_id: "round-1",
        player_id: "players/178864",
        sum: 54,
        dnf: false,
      },
      {
        competition_id: "round-2",
        player_id: "players/178864",
        sum: null,
        dnf: true,
      },
      {
        competition_id: "round-1",
        player_id: "player-2",
        sum: 55,
        dnf: false,
      },
      {
        competition_id: "round-2",
        player_id: "player-2",
        sum: 56,
        dnf: false,
      },
      {
        competition_id: "round-1",
        player_id: "player-3",
        sum: 57,
        dnf: false,
      },
      {
        competition_id: "round-2",
        player_id: "player-3",
        sum: 57,
        dnf: false,
      },
    ],
  );

  assert.equal(
    placementByOwnerCompetitionAndPlayerId.get("event-3186083:players/178864"),
    undefined,
  );
  assert.equal(placementByOwnerCompetitionAndPlayerId.get("event-3186083:player-2"), 1);
  assert.equal(placementByOwnerCompetitionAndPlayerId.get("event-3186083:player-3"), 2);
});

test("aggregateSeasonStandingsByCompetition sums season points per competition", () => {
  const aggregated = aggregateSeasonStandingsByCompetition([
    {
      competition_id: "competition-1",
      season_code: "2026",
      season_points: 120.5,
    },
    {
      competition_id: "competition-1",
      season_code: "2026",
      season_points: 77,
    },
    {
      competition_id: "competition-2",
      season_code: "2026",
      season_points: "15.25",
    },
    {
      competition_id: "competition-2",
      season_code: "2026",
      season_points: null,
    },
    {
      competition_id: null,
      season_code: "2026",
      season_points: 10,
    },
  ]);

  assert.equal(aggregated.get("competition-1"), 197.5);
  assert.equal(aggregated.get("competition-2"), 15.25);
  assert.equal(aggregated.get("competition-3"), undefined);
});

test("aggregateSeasonStandingsByCompetition keeps only the latest season per competition", () => {
  const aggregated = aggregateSeasonStandingsByCompetition([
    {
      competition_id: "competition-1",
      season_code: "2025",
      season_points: 200,
    },
    {
      competition_id: "competition-1",
      season_code: "2026",
      season_points: 110,
    },
    {
      competition_id: "competition-1",
      season_code: "2026",
      season_points: 40,
    },
  ]);

  assert.equal(aggregated.get("competition-1"), 150);
});

test("aggregateSeasonStandingsByCompetition prefers season with more players", () => {
  const aggregated = aggregateSeasonStandingsByCompetition([
    {
      competition_id: "competition-1",
      player_id: "player-1",
      season_code: "2027",
      season_points: 100,
    },
    {
      competition_id: "competition-1",
      player_id: "player-1",
      season_code: "2026",
      season_points: 40,
    },
    {
      competition_id: "competition-1",
      player_id: "player-2",
      season_code: "2026",
      season_points: 40,
    },
  ]);

  assert.equal(aggregated.get("competition-1"), 80);
});

test("loadPaginatedSeasonStandingsRows reads all pages until the final partial page", async () => {
  const requestedRanges: Array<{ from: number; to: number }> = [];
  const rows = await loadPaginatedSeasonStandingsRows(
    async (from, to) => {
      requestedRanges.push({ from, to });
      if (from === 0) {
        return [
          {
            competition_id: "competition-1",
            season_code: "2025",
            player_id: "player-1",
            season_points: 10,
          },
          {
            competition_id: "competition-1",
            season_code: "2025",
            player_id: "player-2",
            season_points: 8,
          },
        ];
      }

      if (from === 2) {
        return [
          {
            competition_id: "competition-2",
            season_code: "2025",
            player_id: "player-3",
            season_points: 14,
          },
          {
            competition_id: "competition-2",
            season_code: "2025",
            player_id: "player-4",
            season_points: 12,
          },
        ];
      }

      if (from === 4) {
        return [
          {
            competition_id: "competition-3",
            season_code: "2025",
            player_id: "player-5",
            season_points: 16,
          },
        ];
      }

      return [];
    },
    2,
  );

  assert.deepEqual(requestedRanges, [
    { from: 0, to: 1 },
    { from: 2, to: 3 },
    { from: 4, to: 5 },
  ]);
  assert.equal(rows.length, 5);
  assert.equal(rows[4]?.competition_id, "competition-3");
});

test("resolveCompetitionSeasonPointsByCompetitionId projects owner season points to child rounds", () => {
  const projected = resolveCompetitionSeasonPointsByCompetitionId(
    [
      {
        competition_id: "event-100",
        competition_name: "Event",
        competition_date: "2026-06-01",
        parent_id: null,
        course_id: null,
        course_name: null,
        record_type: "4",
        players_count: 20,
        metrix_id: null,
      },
      {
        competition_id: "round-100-1",
        competition_name: "Round 1",
        competition_date: "2026-06-01",
        parent_id: "event-100",
        course_id: null,
        course_name: null,
        record_type: "1",
        players_count: 20,
        metrix_id: null,
      },
    ],
    new Map([["event-100", 321.5]]),
  );

  assert.equal(projected.get("event-100"), 321.5);
  assert.equal(projected.get("round-100-1"), 321.5);
});

test("resolveSeasonPointsCompetitionIdForResult uses scoring parent for round rows", () => {
  const competitionsById = new Map([
    [
      "event-100",
      {
        competition_id: "event-100",
        parent_id: null,
        record_type: "4",
      },
    ],
    [
      "pool-100",
      {
        competition_id: "pool-100",
        parent_id: "event-100",
        record_type: "3",
      },
    ],
    [
      "round-1",
      {
        competition_id: "round-1",
        parent_id: "pool-100",
        record_type: "1",
      },
    ],
    [
      "single-100",
      {
        competition_id: "single-100",
        parent_id: null,
        record_type: "2",
      },
    ],
  ]);

  assert.equal(
    resolveSeasonPointsCompetitionIdForResult("round-1", competitionsById),
    "event-100",
  );
  assert.equal(
    resolveSeasonPointsCompetitionIdForResult("single-100", competitionsById),
    "single-100",
  );
  assert.equal(
    resolveSeasonPointsCompetitionIdForResult(
      "round-orphan",
      new Map([
        ...competitionsById,
        [
          "round-orphan",
          {
            competition_id: "round-orphan",
            parent_id: null,
            record_type: "1",
          },
        ],
      ]),
    ),
    "round-orphan",
  );
  assert.equal(
    resolveSeasonPointsCompetitionIdForResult("unknown-100", competitionsById),
    "unknown-100",
  );
});

test("resolveSeasonPointsCompetitionIdForResult keeps pool as owner for multi-pool events", () => {
  const competitionsById = new Map([
    [
      "event-200",
      {
        competition_id: "event-200",
        parent_id: null,
        record_type: "4",
      },
    ],
    [
      "pool-long",
      {
        competition_id: "pool-long",
        parent_id: "event-200",
        record_type: "3",
      },
    ],
    [
      "pool-short",
      {
        competition_id: "pool-short",
        parent_id: "event-200",
        record_type: "3",
      },
    ],
    [
      "round-long-1",
      {
        competition_id: "round-long-1",
        parent_id: "pool-long",
        record_type: "1",
      },
    ],
    [
      "round-short-1",
      {
        competition_id: "round-short-1",
        parent_id: "pool-short",
        record_type: "1",
      },
    ],
  ]);

  assert.equal(
    resolveSeasonPointsCompetitionIdForResult("round-long-1", competitionsById),
    "pool-long",
  );
  assert.equal(
    resolveSeasonPointsCompetitionIdForResult("round-short-1", competitionsById),
    "pool-short",
  );
});

test("resolveLegacyFallbackCompetitionSelectColumns keeps category_id when only comment column is missing", () => {
  const selectColumns = resolveLegacyFallbackCompetitionSelectColumns({
    code: "42703",
    message: 'column competitions.comment does not exist',
  });

  assert.match(selectColumns ?? "", /category_id/);
  assert.doesNotMatch(selectColumns ?? "", /comment/);
});

test("resolveLegacyFallbackCompetitionSelectColumns uses full legacy projection when category_id is missing", () => {
  const selectColumns = resolveLegacyFallbackCompetitionSelectColumns({
    code: "42703",
    message: 'column competitions.category_id does not exist',
  });

  assert.doesNotMatch(selectColumns ?? "", /category_id/);
  assert.doesNotMatch(selectColumns ?? "", /comment/);
});

test("resolveCanonicalSeasonCodeByCompetition chooses season with most owner rows", () => {
  const canonical = resolveCanonicalSeasonCodeByCompetition([
    {
      competition_id: "event-100",
      player_id: "player-1",
      season_code: "2025",
      season_points: 120,
    },
    {
      competition_id: "event-100",
      player_id: "player-1",
      season_code: "2026",
      season_points: 100,
    },
    {
      competition_id: "event-100",
      player_id: "player-2",
      season_code: "2026",
      season_points: 90,
    },
  ]);

  assert.equal(canonical.get("event-100"), "2026");
});

test("resolveSeasonPointsByResultIdentity maps child round rows to owner season points", () => {
  const competitionsById = new Map([
    [
      "event-100",
      {
        competition_id: "event-100",
        parent_id: null,
        record_type: "4",
      },
    ],
    [
      "round-1",
      {
        competition_id: "round-1",
        parent_id: "event-100",
        record_type: "1",
      },
    ],
  ]);

  const seasonPointsByResultIdentity = resolveSeasonPointsByResultIdentity(
    [
      {
        competition_id: "round-1",
        player_id: "player-1",
      },
    ],
    competitionsById,
    [
      {
        competition_id: "event-100",
        player_id: "player-1",
        season_code: "2026",
        season_points: 88.5,
      },
      {
        competition_id: "event-100",
        player_id: "player-1",
        season_code: "2025",
        season_points: 12,
      },
      {
        competition_id: "event-100",
        player_id: "player-2",
        season_code: "2026",
        season_points: 71,
      },
    ],
  );

  assert.equal(seasonPointsByResultIdentity.get("round-1:player-1"), 88.5);
});

test("GET /tournament-categories returns persisted categories via the API envelope", async () => {
  const response = await invokeRequest(
    "/tournament-categories",
    {},
    {
      tournamentCategories: {
        listTournamentCategories: async () => [
          {
            categoryId: "category-100",
            name: "Любительские",
            description: "Турниры начального уровня.",
            competitionClass: "tournament",
            segmentsCount: 18,
            ratingGte: 72.5,
            ratingLt: 84.3,
            coefficient: 1.15,
          },
          {
            categoryId: "category-101",
            name: "Профессиональные",
            description: "Категория для сильных составов.",
            competitionClass: "league",
            segmentsCount: 21,
            ratingGte: 84.3,
            ratingLt: 999,
            coefficient: 1.25,
          },
        ],
      },
    },
  );
  const payload = JSON.parse(response.body) as {
    data: Array<{
      categoryId: string;
      name: string;
      description: string;
      competitionClass: "league" | "tournament";
      segmentsCount: number;
      ratingGte: number;
      ratingLt: number;
      coefficient: number;
    }>;
    meta: {
      count: number;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(payload.meta.count, 2);
  assert.deepEqual(payload.data[0], {
    categoryId: "category-100",
    name: "Любительские",
    description: "Турниры начального уровня.",
    competitionClass: "tournament",
    segmentsCount: 18,
    ratingGte: 72.5,
    ratingLt: 84.3,
    coefficient: 1.15,
  });
});

test("GET /seasons returns persisted seasons via the API envelope", async () => {
  const response = await invokeRequest(
    "/seasons",
    {},
    {
      seasons: {
        listSeasons: async () => [
          {
            seasonCode: "2027",
            name: "Сезон РДГА 2027",
            dateFrom: "2027-04-01",
            dateTo: "2027-11-01",
            bestLeaguesCount: 5,
            bestTournamentsCount: 4,
          },
          {
            seasonCode: "2026",
            name: "Сезон РДГА 2026",
            dateFrom: "2026-04-01",
            dateTo: "2026-11-01",
            bestLeaguesCount: 4,
            bestTournamentsCount: 4,
          },
        ],
      },
    },
  );
  const payload = JSON.parse(response.body) as {
    data: Array<{
      seasonCode: string;
      name: string;
      dateFrom: string;
      dateTo: string;
      bestLeaguesCount: number;
      bestTournamentsCount: number;
    }>;
    meta: {
      count: number;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(payload.meta.count, 2);
  assert.deepEqual(payload.data[0], {
    seasonCode: "2027",
    name: "Сезон РДГА 2027",
    dateFrom: "2027-04-01",
    dateTo: "2027-11-01",
    bestLeaguesCount: 5,
    bestTournamentsCount: 4,
  });
});

test("POST /seasons is blocked because seasons are migration-managed", async () => {
  const response = await invokeRequest("/seasons", {
    method: "POST",
    body: JSON.stringify({
      seasonCode: "2028",
      name: "Сезон РДГА 2028",
    }),
  });

  const payload = JSON.parse(response.body) as {
    error: {
      code: string;
      message: string;
    };
  };

  assert.equal(response.statusCode, 405);
  assert.equal(payload.error.code, "seasons_read_only");
  assert.equal(payload.error.message, "Seasons are managed via database migrations only");
});

test("GET /season-points-table forwards filters to the module", async () => {
  let receivedFilters:
    | {
        seasonCode?: string;
        playersCount?: number;
      }
    | undefined;

  const response = await invokeRequest(
    "/season-points-table?seasonCode=2026&playersCount=32",
    {},
    {
      seasonPointsTable: {
        listSeasonPointsEntries: async (filters) => {
          receivedFilters = filters;

          return [
            {
              seasonCode: "2026",
              playersCount: 32,
              placement: 1,
              points: 75,
            },
          ];
        },
      },
    },
  );
  const payload = JSON.parse(response.body) as {
    data: Array<{
      seasonCode: string;
      playersCount: number;
      placement: number;
      points: number;
    }>;
    meta: {
      count: number;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.deepEqual(receivedFilters, {
    seasonCode: "2026",
    playersCount: 32,
  });
  assert.equal(payload.meta.count, 1);
  assert.deepEqual(payload.data[0], {
    seasonCode: "2026",
    playersCount: 32,
    placement: 1,
    points: 75,
  });
});

test("POST /season-standings/accrual runs points accrual for authenticated user", async () => {
  let receivedPayload:
    | {
        seasonCode: string;
        overwriteExisting?: boolean;
      }
    | undefined;

  const response = await invokeRequest(
    "/season-standings/accrual",
    {
      method: "POST",
      headers: {
        authorization: "Bearer season-token-1",
      },
      body: JSON.stringify({
        seasonCode: "2026",
        overwriteExisting: true,
      }),
    },
    {
      auth: {
        requireAuthenticatedUser: async (sessionToken) => {
          assert.equal(sessionToken, "season-token-1");

          return {
            login: "admin",
          };
        },
      },
      seasonStandings: {
        runSeasonPointsAccrual: async (payload) => {
          receivedPayload = payload;

          return {
            seasonCode: "2026",
            overwriteExisting: true,
            competitionsInSeason: 10,
            competitionsEligible: 8,
            competitionsSkippedByExisting: 0,
            competitionsWithPoints: 8,
            rowsPrepared: 210,
            rowsPersisted: 210,
          };
        },
      },
    },
  );

  const envelope = JSON.parse(response.body) as {
    data: {
      seasonCode: string;
      rowsPersisted: number;
      competitionsWithPoints: number;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.deepEqual(receivedPayload, {
    seasonCode: "2026",
    overwriteExisting: true,
  });
  assert.equal(envelope.data.seasonCode, "2026");
  assert.equal(envelope.data.rowsPersisted, 210);
  assert.equal(envelope.data.competitionsWithPoints, 8);
});

test("POST /season-standings/accrual invalidates read cache for subsequent projections", async () => {
  let listCompetitionsCalls = 0;
  const handler = createApiRequestHandler({
    competitions: {
      listCompetitions: async () => {
        listCompetitionsCalls += 1;
        return [
          {
            competitionId: "competition-100",
            competitionName: "Spring Open",
            competitionDate: "2026-04-10",
            parentId: null,
            courseId: null,
            courseName: null,
            categoryId: null,
            comment: null,
            recordType: "event",
            playersCount: 32,
            metrixId: "metrix-100",
            hasResults: true,
            seasonPoints: 120,
          },
        ];
      },
    },
    auth: {
      requireAuthenticatedUser: async () => ({
        login: "admin",
      }),
    },
    seasonStandings: {
      runSeasonPointsAccrual: async () => ({
        seasonCode: "2026",
        overwriteExisting: true,
        competitionsInSeason: 1,
        competitionsEligible: 1,
        competitionsSkippedByExisting: 0,
        competitionsWithPoints: 1,
        rowsPrepared: 10,
        rowsPersisted: 10,
      }),
    },
  });

  const firstListResponse = await invokeRequestWithHandler(handler, "/competitions");
  const secondListResponse = await invokeRequestWithHandler(handler, "/competitions");
  const accrualResponse = await invokeRequestWithHandler(
    handler,
    "/season-standings/accrual",
    {
      method: "POST",
      headers: {
        authorization: "Bearer token-100",
      },
      body: JSON.stringify({
        seasonCode: "2026",
        overwriteExisting: true,
      }),
    },
  );
  const thirdListResponse = await invokeRequestWithHandler(handler, "/competitions");

  assert.equal(firstListResponse.statusCode, 200);
  assert.equal(secondListResponse.statusCode, 200);
  assert.equal(accrualResponse.statusCode, 200);
  assert.equal(thirdListResponse.statusCode, 200);
  assert.equal(listCompetitionsCalls, 2);
});

test("season standings ranking uses lowest sum and excludes DNF-style rows", () => {
  const rankedResults = rankCompetitionResultsForSeasonPoints([
    {
      competition_id: "event-1",
      player_id: "player-from-db-place-3",
      sum: 50,
      dnf: false,
    },
    {
      competition_id: "event-1",
      player_id: "player-from-db-place-1",
      sum: 47,
      dnf: false,
    },
    {
      competition_id: "event-1",
      player_id: "player-tied",
      sum: 47,
      dnf: false,
    },
    {
      competition_id: "event-1",
      player_id: "player-null-sum",
      sum: null,
      dnf: false,
    },
    {
      competition_id: "event-1",
      player_id: "player-dnf",
      sum: 46,
      dnf: true,
    },
  ]);

  assert.deepEqual(rankedResults, [
    {
      player_id: "player-from-db-place-1",
      placement: 1,
    },
    {
      player_id: "player-tied",
      placement: 1,
    },
    {
      player_id: "player-from-db-place-3",
      placement: 3,
    },
  ]);
});

test("loadPaginatedCompetitionResults reads all pages past the default page limit", async () => {
  const requestedRanges: Array<{ from: number; to: number }> = [];

  const results = await loadPaginatedCompetitionResults(async (from, to) => {
    requestedRanges.push({ from, to });

    if (from === 0) {
      return Array.from({ length: 1000 }, (_, index) => ({
        competition_id: "event-page-1",
        player_id: `player-${index + 1}`,
        sum: index + 1,
        dnf: false,
      }));
    }

    if (from === 1000) {
      return [
        {
          competition_id: "event-page-2",
          player_id: "player-1001",
          sum: 1001,
          dnf: false,
        },
        {
          competition_id: "event-page-2",
          player_id: "player-1002",
          sum: 1002,
          dnf: false,
        },
      ];
    }

    return [];
  });

  assert.deepEqual(requestedRanges, [
    {
      from: 0,
      to: 999,
    },
    {
      from: 1000,
      to: 1999,
    },
  ]);
  assert.equal(results.length, 1002);
  assert.deepEqual(results.at(0), {
    competition_id: "event-page-1",
    player_id: "player-1",
    sum: 1,
    dnf: false,
  });
  assert.deepEqual(results.at(-1), {
    competition_id: "event-page-2",
    player_id: "player-1002",
    sum: 1002,
    dnf: false,
  });
});

test("loadPaginatedSeasonPointsMatrix reads all pages past the default page limit", async () => {
  const requestedRanges: Array<{ from: number; to: number }> = [];

  const matrix = await loadPaginatedSeasonPointsMatrix(async (from, to) => {
    requestedRanges.push({ from, to });

    if (from === 0) {
      return Array.from({ length: 1000 }, (_, index) => ({
        players_count: 57,
        placement: index + 1,
        points: 100 - index / 10,
      }));
    }

    if (from === 1000) {
      return [
        {
          players_count: 57,
          placement: 1001,
          points: 0.1,
        },
      ];
    }

    return [];
  });

  assert.deepEqual(requestedRanges, [
    {
      from: 0,
      to: 999,
    },
    {
      from: 1000,
      to: 1999,
    },
  ]);
  assert.equal(matrix.length, 1001);
  assert.deepEqual(matrix.at(0), {
    players_count: 57,
    placement: 1,
    points: 100,
  });
  assert.deepEqual(matrix.at(-1), {
    players_count: 57,
    placement: 1001,
    points: 0.1,
  });
});

test("season standings ranking requires all rounds for parent -> pool -> round", () => {
  const rankedResults = rankCompetitionResultsForSeasonPoints(
    [
      {
        competition_id: "round-1",
        player_id: "player-1",
        sum: 52,
        dnf: false,
      },
      {
        competition_id: "round-2",
        player_id: "player-1",
        sum: 54,
        dnf: false,
      },
      {
        competition_id: "round-1",
        player_id: "player-2",
        sum: 50,
        dnf: false,
      },
      {
        competition_id: "round-2",
        player_id: "player-2",
        sum: null,
        dnf: false,
      },
      {
        competition_id: "round-1",
        player_id: "player-3",
        sum: 51,
        dnf: false,
      },
    ],
    ["round-1", "round-2"],
  );

  assert.deepEqual(rankedResults, [
    {
      player_id: "player-1",
      placement: 1,
    },
  ]);
});

test("buildSeasonScoringCompetitionUnits resolves visible event as scoring competition and inherits round results through a single pool", () => {
  const units = buildSeasonScoringCompetitionUnits([
    {
      competition_id: "event-100",
      category_id: "category-pro",
      parent_id: null,
      record_type: "4",
      players_count: 42,
    },
    {
      competition_id: "pool-100",
      category_id: null,
      parent_id: "event-100",
      record_type: "3",
      players_count: null,
    },
    {
      competition_id: "round-1",
      category_id: null,
      parent_id: "pool-100",
      record_type: "1",
      players_count: null,
    },
    {
      competition_id: "round-2",
      category_id: null,
      parent_id: "pool-100",
      record_type: "1",
      players_count: null,
    },
  ]);

  assert.deepEqual(units, [
    {
      competition_id: "event-100",
      comment: null,
      category_id: "category-pro",
      players_count: 42,
      source_competition_ids: ["round-1", "round-2"],
    },
  ]);
});

test("buildSeasonScoringCompetitionUnits uses pools as scoring units for multi-pool events", () => {
  const units = buildSeasonScoringCompetitionUnits([
    {
      competition_id: "event-3234123",
      category_id: "category-pro",
      parent_id: null,
      record_type: "4",
      players_count: null,
    },
    {
      competition_id: "pool-long",
      category_id: null,
      parent_id: "event-3234123",
      record_type: "3",
      players_count: 56,
    },
    {
      competition_id: "pool-short",
      category_id: null,
      parent_id: "event-3234123",
      record_type: "3",
      players_count: 11,
    },
    {
      competition_id: "round-long-1",
      category_id: null,
      parent_id: "pool-long",
      record_type: "1",
      players_count: null,
    },
    {
      competition_id: "round-long-2",
      category_id: null,
      parent_id: "pool-long",
      record_type: "1",
      players_count: null,
    },
    {
      competition_id: "round-short-1",
      category_id: null,
      parent_id: "pool-short",
      record_type: "1",
      players_count: null,
    },
    {
      competition_id: "round-short-2",
      category_id: null,
      parent_id: "pool-short",
      record_type: "1",
      players_count: null,
    },
  ]);

  assert.deepEqual(units, [
    {
      competition_id: "pool-long",
      comment: null,
      category_id: "category-pro",
      players_count: 56,
      source_competition_ids: ["round-long-1", "round-long-2"],
    },
    {
      competition_id: "pool-short",
      comment: null,
      category_id: "category-pro",
      players_count: 11,
      source_competition_ids: ["round-short-1", "round-short-2"],
    },
  ]);
});

test("buildSeasonScoringCompetitionUnits keeps visible event without child rounds as a standalone scoring competition", () => {
  const units = buildSeasonScoringCompetitionUnits([
    {
      competition_id: "event-standalone",
      category_id: "category-pro",
      parent_id: null,
      record_type: "4",
      players_count: 18,
    },
  ]);

  assert.deepEqual(units, [
    {
      competition_id: "event-standalone",
      comment: null,
      category_id: "category-pro",
      players_count: 18,
      source_competition_ids: ["event-standalone"],
    },
  ]);
});

test("buildSeasonScoringCompetitionUnits treats orphan round rows as standalone competitions", () => {
  const units = buildSeasonScoringCompetitionUnits([
    {
      competition_id: "round-orphan",
      category_id: "category-pro",
      parent_id: null,
      record_type: "1",
      players_count: 12,
    },
  ]);

  assert.deepEqual(units, [
    {
      competition_id: "round-orphan",
      comment: null,
      category_id: "category-pro",
      players_count: 12,
      source_competition_ids: ["round-orphan"],
    },
  ]);
});

test("runSeasonPointsAccrual uses scoring competition players_count for matrix lookup when fewer players finish", async () => {
  let savedStandings: Array<{
    players_count: number;
    raw_points: number;
    season_points: number;
    placement: number;
    player_id: string;
  }> = [];

  const result = await runSeasonPointsAccrual(
    {
      seasonCode: "2025",
      overwriteExisting: true,
    },
    {
      async findSeasonByCode(seasonCode) {
        assert.equal(seasonCode, "2025");
        return {
          season_code: "2025",
          date_from: "2025-01-01",
          date_to: "2025-12-31",
        };
      },
      async listCompetitionsInSeason() {
        return [
          {
            competition_id: "event-3186083",
            category_id: "category-2",
            parent_id: null,
            record_type: "4",
            players_count: 42,
          },
        ];
      },
      async listCompetitionResults() {
        return [
          {
            competition_id: "event-3186083",
            player_id: "player-1",
            sum: 50,
            dnf: false,
          },
          {
            competition_id: "event-3186083",
            player_id: "player-2",
            sum: 51,
            dnf: false,
          },
          {
            competition_id: "event-3186083",
            player_id: "player-3",
            sum: 52,
            dnf: false,
          },
          {
            competition_id: "event-3186083",
            player_id: "player-dnf",
            sum: 65,
            dnf: true,
          },
        ];
      },
      async listCategoryCoefficients() {
        return [
          {
            category_id: "category-2",
            coefficient: 3,
          },
        ];
      },
      async listSeasonPointsMatrix() {
        return [
          {
            players_count: 42,
            placement: 1,
            points: 80,
          },
          {
            players_count: 42,
            placement: 2,
            points: 72,
          },
          {
            players_count: 42,
            placement: 3,
            points: 65,
          },
          {
            players_count: 3,
            placement: 1,
            points: 78.5,
          },
          {
            players_count: 3,
            placement: 2,
            points: 70,
          },
          {
            players_count: 3,
            placement: 3,
            points: 64,
          },
        ];
      },
      async listExistingCompetitionIds() {
        return new Set<string>();
      },
      async upsertSeasonStandings(standings) {
        savedStandings = standings.map((row) => ({
          players_count: row.players_count,
          raw_points: row.raw_points,
          season_points: row.season_points,
          placement: row.placement,
          player_id: row.player_id,
        }));

        return standings.length;
      },
    },
  );

  assert.equal(result.competitionsEligible, 1);
  assert.equal(result.competitionsWithPoints, 1);
  assert.equal(result.rowsPrepared, 3);
  assert.equal(result.rowsPersisted, 3);
  assert.deepEqual(savedStandings, [
    {
      players_count: 42,
      raw_points: 80,
      season_points: 240,
      placement: 1,
      player_id: "player-1",
    },
    {
      players_count: 42,
      raw_points: 72,
      season_points: 216,
      placement: 2,
      player_id: "player-2",
    },
    {
      players_count: 42,
      raw_points: 65,
      season_points: 195,
      placement: 3,
      player_id: "player-3",
    },
  ]);
});

test("runSeasonPointsAccrual does not apply season-specific minimum players threshold", async () => {
  let savedStandings: Array<{
    competition_id: string;
    players_count: number;
    raw_points: number;
    season_points: number;
  }> = [];

  const result = await runSeasonPointsAccrual(
    {
      seasonCode: "2027",
      overwriteExisting: true,
    },
    {
      async findSeasonByCode(seasonCode) {
        assert.equal(seasonCode, "2027");
        return {
          season_code: "2027",
          date_from: "2027-01-01",
          date_to: "2027-12-31",
        };
      },
      async listCompetitionsInSeason() {
        return [
          {
            competition_id: "event-2027-1",
            category_id: "category-pro",
            parent_id: null,
            record_type: "4",
            players_count: 8,
          },
        ];
      },
      async listCompetitionResults() {
        return [
          {
            competition_id: "event-2027-1",
            player_id: "player-1",
            sum: 50,
            dnf: false,
          },
        ];
      },
      async listCategoryCoefficients() {
        return [
          {
            category_id: "category-pro",
            coefficient: 1,
          },
        ];
      },
      async listSeasonPointsMatrix() {
        return [
          {
            players_count: 8,
            placement: 1,
            points: 80,
          },
        ];
      },
      async listExistingCompetitionIds() {
        return new Set<string>();
      },
      async upsertSeasonStandings(standings) {
        savedStandings = standings.map((row) => ({
          competition_id: row.competition_id,
          players_count: row.players_count,
          raw_points: row.raw_points,
          season_points: row.season_points,
        }));

        return standings.length;
      },
    },
  );

  assert.equal(result.competitionsEligible, 1);
  assert.equal(result.competitionsWithPoints, 1);
  assert.equal(result.rowsPrepared, 1);
  assert.equal(result.rowsPersisted, 1);
  assert.deepEqual(savedStandings, [
    {
      competition_id: "event-2027-1",
      players_count: 8,
      raw_points: 80,
      season_points: 80,
    },
  ]);
});

test("runSeasonPointsAccrual clears stale season standings rows before overwrite recompute", async () => {
  let clearedSeasonCode: string | null = null;
  let clearedCompetitionIds: string[] = [];
  let savedStandingsCount = 0;

  const result = await runSeasonPointsAccrual(
    {
      seasonCode: "2026",
      overwriteExisting: true,
    },
    {
      async findSeasonByCode() {
        return {
          season_code: "2026",
          date_from: "2026-01-01",
          date_to: "2026-12-31",
        };
      },
      async listCompetitionsInSeason() {
        return [
          {
            competition_id: "event-3535332",
            category_id: "category-pro",
            parent_id: null,
            record_type: "4",
            players_count: 24,
          },
        ];
      },
      async listCompetitionResults() {
        return [
          {
            competition_id: "event-3535332",
            player_id: "player-valid",
            sum: 50,
            dnf: false,
          },
          {
            competition_id: "event-3535332",
            player_id: "32953",
            sum: 30,
            dnf: true,
          },
        ];
      },
      async listCategoryCoefficients() {
        return [
          {
            category_id: "category-pro",
            coefficient: 1,
          },
        ];
      },
      async listSeasonPointsMatrix() {
        return [
          {
            players_count: 24,
            placement: 1,
            points: 80,
          },
        ];
      },
      async listExistingCompetitionIds() {
        return new Set<string>(["event-3535332"]);
      },
      async clearSeasonStandingsForCompetitions(seasonCode, competitionIds) {
        clearedSeasonCode = seasonCode;
        clearedCompetitionIds = [...competitionIds];
      },
      async upsertSeasonStandings(standings) {
        savedStandingsCount = standings.length;
        return standings.length;
      },
    },
  );

  assert.equal(clearedSeasonCode, "2026");
  assert.deepEqual(clearedCompetitionIds, ["event-3535332"]);
  assert.equal(savedStandingsCount, 1);
  assert.equal(result.rowsPrepared, 1);
  assert.equal(result.rowsPersisted, 1);
});

test("runSeasonPointsAccrual writes an automated category resolution comment when category is missing", async () => {
  let updatedComment:
    | {
        competitionId: string;
        comment: string | null;
      }
    | undefined;

  await runSeasonPointsAccrual(
    {
      seasonCode: "2026",
      overwriteExisting: true,
    },
    {
      async findSeasonByCode() {
        return {
          season_code: "2026",
          date_from: "2026-01-01",
          date_to: "2026-12-31",
        };
      },
      async listCompetitionsInSeason() {
        return [
          {
            competition_id: "event-400",
            category_id: null,
            comment: null,
            parent_id: null,
            record_type: "4",
            players_count: 24,
          },
        ];
      },
      async listCompetitionResults() {
        return [];
      },
      async listCategoryCoefficients() {
        return [];
      },
      async listSeasonPointsMatrix() {
        return [];
      },
      async listExistingCompetitionIds() {
        return new Set<string>();
      },
      async updateCompetitionComment(competitionId, comment) {
        updatedComment = {
          competitionId,
          comment,
        };
      },
      async upsertSeasonStandings() {
        return 0;
      },
    },
  );

  assert.deepEqual(updatedComment, {
    competitionId: "event-400",
    comment: "Не удалось определить категорию для начисления очков сезона.",
  });
});

test("runSeasonPointsAccrual clears stale season comments after a successful recompute", async () => {
  const updatedComments: Array<{
    competitionId: string;
    comment: string | null;
  }> = [];

  await runSeasonPointsAccrual(
    {
      seasonCode: "2026",
      overwriteExisting: true,
    },
    {
      async findSeasonByCode() {
        return {
          season_code: "2026",
          date_from: "2026-01-01",
          date_to: "2026-12-31",
        };
      },
      async listCompetitionsInSeason() {
        return [
          {
            competition_id: "event-401",
            category_id: "category-401",
            comment: "Не удалось начислить очки сезона: не найдена строка в таблице очков.",
            parent_id: null,
            record_type: "4",
            players_count: 24,
          },
        ];
      },
      async listCompetitionResults() {
        return [
          {
            competition_id: "event-401",
            player_id: "player-1",
            sum: 50,
            dnf: false,
          },
        ];
      },
      async listCategoryCoefficients() {
        return [
          {
            category_id: "category-401",
            coefficient: 1,
          },
        ];
      },
      async listSeasonPointsMatrix() {
        return [
          {
            players_count: 24,
            placement: 1,
            points: 80,
          },
        ];
      },
      async listExistingCompetitionIds() {
        return new Set<string>();
      },
      async updateCompetitionComment(competitionId, comment) {
        updatedComments.push({
          competitionId,
          comment,
        });
      },
      async upsertSeasonStandings(standings) {
        return standings.length;
      },
    },
  );

  assert.deepEqual(updatedComments, [
    {
      competitionId: "event-401",
      comment: null,
    },
  ]);
});

test("GET /auth/session returns the anonymous session when there is no token", async () => {
  const response = await invokeRequest("/auth/session");
  const payload = JSON.parse(response.body) as {
    data: {
      authenticated: boolean;
      user: null;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.deepEqual(payload.data, {
    authenticated: false,
    user: null,
  });
});

test("POST /auth/login returns session token and authenticated user", async () => {
  let receivedCredentials:
    | {
        login: string;
        password: string;
      }
    | undefined;

  const response = await invokeRequest(
    "/auth/login",
    {
      method: "POST",
      body: JSON.stringify({
        login: "admin",
        password: "secret",
      }),
    },
    {
      auth: {
        login: async (credentials) => {
          receivedCredentials = credentials;

          return {
            sessionToken: "session-100",
            session: {
              authenticated: true,
              user: {
                login: "admin",
                createdAt: "2026-03-24T08:00:00.000Z",
              },
            },
          };
        },
      },
    },
  );
  const payload = JSON.parse(response.body) as {
    data: {
      sessionToken: string;
      session: {
        authenticated: boolean;
        user: {
          login: string;
          createdAt: string;
        };
      };
    };
  };

  assert.equal(response.statusCode, 200);
  assert.deepEqual(receivedCredentials, {
    login: "admin",
    password: "secret",
  });
  assert.equal(payload.data.sessionToken, "session-100");
  assert.equal(payload.data.session.authenticated, true);
  assert.equal(payload.data.session.user.login, "admin");
});

test("POST /auth/logout forwards the current token and clears the session", async () => {
  let receivedToken: string | null | undefined;

  const response = await invokeRequest(
    "/auth/logout",
    {
      method: "POST",
      headers: {
        authorization: "Bearer session-100",
      },
    },
    {
      auth: {
        logout: async (sessionToken) => {
          receivedToken = sessionToken;
        },
      },
    },
  );

  assert.equal(response.statusCode, 200);
  assert.equal(receivedToken, "session-100");
  assert.deepEqual(JSON.parse(response.body), {
    data: {
      authenticated: false,
      user: null,
    },
  });
});

test("PUT /players updates editable player fields and returns the updated player", async () => {
  let receivedPayload:
    | {
        playerId: string;
        division: string | null;
        rdga: boolean | null;
        rdgaSince: string | null;
        seasonDivision: string | null;
      }
    | undefined;

  const response = await invokeRequest(
    "/players",
    {
      method: "PUT",
      headers: {
        authorization: "Bearer session-100",
      },
      body: JSON.stringify({
        playerId: "player-100",
        division: "MA2",
        rdga: false,
        rdgaSince: "2026-03-01",
        seasonDivision: "MA2",
      }),
    },
    {
      players: {
        updatePlayer: async (payload) => {
          receivedPayload = payload;

          return {
            playerId: payload.playerId,
            playerName: "Ivan Ivanov",
            division: payload.division,
            rdga: payload.rdga,
            rdgaSince: payload.rdgaSince,
            seasonDivision: payload.seasonDivision,
            competitionsCount: 3,
          };
        },
      },
      auth: {
        requireAuthenticatedUser: async (sessionToken) => {
          assert.equal(sessionToken, "session-100");

          return {
            login: "admin",
          };
        },
      },
    },
  );
  const payload = JSON.parse(response.body) as {
    data: {
      playerId: string;
      playerName: string;
      division: string | null;
      rdga: boolean | null;
      rdgaSince: string | null;
      seasonDivision: string | null;
      competitionsCount?: number;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.deepEqual(receivedPayload, {
    playerId: "player-100",
    division: "MA2",
    rdga: false,
    rdgaSince: "2026-03-01",
    seasonDivision: "MA2",
  });
  assert.deepEqual(payload.data, {
    playerId: "player-100",
    playerName: "Ivan Ivanov",
    division: "MA2",
    rdga: false,
    rdgaSince: "2026-03-01",
    seasonDivision: "MA2",
    competitionsCount: 3,
  });
});

test("PUT /players auto-sets rdgaSince to current date when rdga is true and date is missing", async () => {
  let receivedPayload:
    | {
        playerId: string;
        division: string | null;
        rdga: boolean | null;
        rdgaSince: string | null;
        seasonDivision: string | null;
      }
    | undefined;

  const response = await invokeRequest(
    "/players",
    {
      method: "PUT",
      headers: {
        authorization: "Bearer session-100",
      },
      body: JSON.stringify({
        playerId: "player-200",
        division: "MPO",
        rdga: true,
        rdgaSince: null,
        seasonDivision: "MPO",
      }),
    },
    {
      players: {
        updatePlayer: async (payload) => {
          receivedPayload = payload;

          return {
            playerId: payload.playerId,
            playerName: "Petr Petrov",
            division: payload.division,
            rdga: payload.rdga,
            rdgaSince: payload.rdgaSince,
            seasonDivision: payload.seasonDivision,
            competitionsCount: 2,
          };
        },
      },
      auth: {
        requireAuthenticatedUser: async () => ({
          login: "admin",
        }),
      },
    },
  );

  const payload = JSON.parse(response.body) as {
    data: {
      rdgaSince: string | null;
    };
  };
  const expectedCurrentDate = new Date().toISOString().slice(0, 10);

  assert.equal(response.statusCode, 200);
  assert.equal(receivedPayload?.rdga, true);
  assert.equal(receivedPayload?.rdgaSince, expectedCurrentDate);
  assert.equal(payload.data.rdgaSince, expectedCurrentDate);
});

test("PUT /players rejects guest edits", async () => {
  const response = await invokeRequest(
    "/players",
    {
      method: "PUT",
      body: JSON.stringify({
        playerId: "player-100",
        division: "MA2",
        rdga: false,
        rdgaSince: "2026-03-01",
        seasonDivision: "MA2",
      }),
    },
    {
      auth: {
        requireAuthenticatedUser: async () => {
          throw new HttpError(401, "unauthorized", "Authentication required");
        },
      },
    },
  );

  assert.equal(response.statusCode, 401);
  assert.deepEqual(JSON.parse(response.body), {
    error: {
      code: "unauthorized",
      message: "Authentication required",
    },
  });
});

test("POST /tournament-categories creates category for authenticated user", async () => {
  let receivedPayload:
    | {
        name: string;
        description: string;
        competitionClass: "league" | "tournament";
        segmentsCount: number;
        ratingGte: number;
        ratingLt: number;
        coefficient: number;
      }
    | undefined;

  const response = await invokeRequest(
    "/tournament-categories",
    {
      method: "POST",
      headers: {
        authorization: "Bearer session-100",
      },
      body: JSON.stringify({
        name: "Любительские",
        description: "Турниры начального уровня.",
        competitionClass: "tournament",
        segmentsCount: 18,
        ratingGte: 72.5,
        ratingLt: 84.3,
        coefficient: 1.15,
      }),
    },
    {
      tournamentCategories: {
        createTournamentCategory: async (payload) => {
          receivedPayload = payload;

          return {
            categoryId: "category-200",
            ...payload,
          };
        },
      },
      auth: {
        requireAuthenticatedUser: async () => ({
          login: "admin",
        }),
      },
    },
  );

  assert.equal(response.statusCode, 201);
  assert.deepEqual(receivedPayload, {
    name: "Любительские",
    description: "Турниры начального уровня.",
    competitionClass: "tournament",
    segmentsCount: 18,
    ratingGte: 72.5,
    ratingLt: 84.3,
    coefficient: 1.15,
  });
});

test("DELETE /tournament-categories removes category for authenticated user", async () => {
  let receivedCategoryId: string | undefined;

  const response = await invokeRequest(
    "/tournament-categories",
    {
      method: "DELETE",
      headers: {
        authorization: "Bearer session-100",
      },
      body: JSON.stringify({
        categoryId: "category-300",
      }),
    },
    {
      tournamentCategories: {
        deleteTournamentCategory: async (payload) => {
          receivedCategoryId = payload.categoryId;
        },
      },
      auth: {
        requireAuthenticatedUser: async () => ({
          login: "admin",
        }),
      },
    },
  );

  assert.equal(response.statusCode, 200);
  assert.equal(receivedCategoryId, "category-300");
  assert.deepEqual(JSON.parse(response.body), {
    data: null,
  });
});

test("GET /results returns persisted competition results via the API envelope", async () => {
  const response = await invokeRequest(
    "/results",
    {},
    {
      results: {
        listResults: async () => [
          {
            competitionId: "competition-100",
            playerId: "player-100",
            competitionName: "Spring Open",
            playerName: "Ivan Ivanov",
            playerRdga: true,
            className: "MPO",
            sum: 54,
            diff: -6,
            dnf: false,
            seasonPoints: 52.9,
          },
          {
            competitionId: "competition-100",
            playerId: "player-101",
            competitionName: "Spring Open",
            playerName: "Anna Petrova",
            playerRdga: null,
            className: "FPO",
            sum: null,
            diff: null,
            dnf: true,
            seasonPoints: null,
          },
        ],
      },
    },
  );
  const payload = JSON.parse(response.body) as {
    data: Array<{
      competitionId: string;
      playerId: string;
      competitionName?: string | null;
      playerName?: string | null;
      playerRdga?: boolean | null;
      className: string | null;
      sum: number | null;
      diff: number | null;
      dnf: boolean;
      seasonPoints?: number | null;
    }>;
    meta: {
      count: number;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(payload.meta.count, 2);
  assert.deepEqual(payload.data[0], {
    competitionId: "competition-100",
    playerId: "player-100",
    competitionName: "Spring Open",
    playerName: "Ivan Ivanov",
    playerRdga: true,
    className: "MPO",
    sum: 54,
    diff: -6,
    dnf: false,
    seasonPoints: 52.9,
  });
  assert.deepEqual(payload.data[1], {
    competitionId: "competition-100",
    playerId: "player-101",
    competitionName: "Spring Open",
    playerName: "Anna Petrova",
    playerRdga: null,
    className: "FPO",
    sum: null,
    diff: null,
    dnf: true,
    seasonPoints: null,
  });
});

test("GET /results forwards competitionId filter to the results module", async () => {
  let receivedFilters:
    | {
        competitionId?: string;
        playerId?: string;
        className?: string;
        dnf?: boolean;
        limit: number;
        offset: number;
      }
    | undefined;

  const response = await invokeRequest(
    "/results?competitionId=competition-100",
    {},
    {
      results: {
        listResults: async (filters) => {
          receivedFilters = filters;

          return [
            {
              competitionId: "competition-100",
              playerId: "player-100",
              competitionName: "Spring Open",
              playerName: "Ivan Ivanov",
              className: "MPO",
              sum: 54,
              diff: -6,
              dnf: false,
            },
          ];
        },
      },
    },
  );
  const payload = JSON.parse(response.body) as {
    data: Array<{
      competitionId: string;
    }>;
    meta: {
      count: number;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.deepEqual(receivedFilters, {
    competitionId: "competition-100",
    playerId: undefined,
    className: undefined,
    dnf: undefined,
    limit: 200,
    offset: 0,
  });
  assert.equal(payload.meta.count, 1);
  assert.equal(payload.data[0]?.competitionId, "competition-100");
});

test("POST /updates/competitions accepts a period-based update command", async () => {
  const response = await invokeRequest(
    "/updates/competitions",
    {
      method: "POST",
      headers: {
        authorization: "Bearer session-100",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        dateFrom: "2026-01-01",
        dateTo: "2026-01-14",
      }),
    },
    {
      updates: {
        executeCompetitionsUpdate: async (period, overwriteExisting) => ({
          operation: "competitions",
          finalStatus: "completed",
          source: "runtime",
          message: "Получили и обработали соревнования.",
          requestedAt: "2026-03-21T10:00:00.000Z",
          finishedAt: "2026-03-21T10:00:01.000Z",
          summary: {
            found: 2,
            created: 0,
            updated: 0,
            skipped: 0,
            errors: 0,
          },
          issues: [],
          period,
        }),
      },
      auth: {
        requireAuthenticatedUser: async (sessionToken) => {
          assert.equal(sessionToken, "session-100");

          return {
            login: "admin",
          };
        },
      },
    },
  );
  const payload = JSON.parse(response.body) as {
    data: {
      operation: string;
      finalStatus: string;
      source: string;
      summary: {
        found: number;
        created: number;
        updated: number;
        skipped: number;
        errors: number;
      };
      issues: Array<{ code: string; recordKey?: string }>;
      period?: { dateFrom: string; dateTo: string };
    };
  };

  assert.equal(response.statusCode, 202);
  assert.equal(payload.data.operation, "competitions");
  assert.equal(payload.data.finalStatus, "completed");
  assert.equal(payload.data.source, "runtime");
  assert.deepEqual(payload.data.summary, {
    found: 2,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
  });
  assert.equal(payload.data.issues.length, 0);
  assert.deepEqual(payload.data.period, {
    dateFrom: "2026-01-01",
    dateTo: "2026-01-14",
  });
});

test("POST /updates/competitions forwards overwriteExisting flag", async () => {
  let receivedOverwriteExisting: boolean | null = null;

  const response = await invokeRequest(
    "/updates/competitions",
    {
      method: "POST",
      headers: {
        authorization: "Bearer session-100",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        dateFrom: "2026-01-01",
        dateTo: "2026-01-14",
        overwriteExisting: true,
      }),
    },
    {
      updates: {
        executeCompetitionsUpdate: async (period, overwriteExisting) => {
          receivedOverwriteExisting = overwriteExisting;

          return {
            operation: "competitions",
            finalStatus: "completed",
            source: "runtime",
            message: "Получили и обработали соревнования.",
            requestedAt: "2026-03-21T10:00:00.000Z",
            finishedAt: "2026-03-21T10:00:01.000Z",
            summary: {
              found: 0,
              created: 0,
              updated: 0,
              skipped: 0,
              errors: 0,
            },
            issues: [],
            period,
          };
        },
      },
      auth: {
        requireAuthenticatedUser: async () => ({
          login: "admin",
        }),
      },
    },
  );

  assert.equal(response.statusCode, 202);
  assert.equal(receivedOverwriteExisting, true);
});

test("POST /updates/competitions returns accepted-job payload when runtime provides background scheduling", async () => {
  const response = await invokeRequest(
    "/updates/competitions",
    {
      method: "POST",
      headers: {
        authorization: "Bearer session-100",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        dateFrom: "2026-01-01",
        dateTo: "2026-01-14",
      }),
    },
    {
      updates: {
        enqueueAcceptedUpdate: async ({ operation, period }) => ({
          jobId: "job-100",
          operation,
          state: "accepted",
          source: "runtime",
          message: "accepted in background queue",
          requestedAt: "2026-03-21T10:00:00.000Z",
          period,
          pollPath: "/updates/jobs/job-100",
        }),
      },
      auth: {
        requireAuthenticatedUser: async () => ({
          login: "admin",
        }),
      },
    },
  );
  const payload = JSON.parse(response.body) as {
    data: {
      jobId: string;
      operation: string;
      state: string;
      pollPath: string;
      period?: { dateFrom: string; dateTo: string };
    };
  };

  assert.equal(response.statusCode, 202);
  assert.equal(payload.data.jobId, "job-100");
  assert.equal(payload.data.operation, "competitions");
  assert.equal(payload.data.state, "accepted");
  assert.equal(payload.data.pollPath, "/updates/jobs/job-100");
  assert.deepEqual(payload.data.period, {
    dateFrom: "2026-01-01",
    dateTo: "2026-01-14",
  });
});

test("GET /updates/jobs/:jobId returns the current background status for authenticated users", async () => {
  const response = await invokeRequest(
    "/updates/jobs/job-100",
    {
      headers: {
        authorization: "Bearer session-100",
      },
    },
    {
      updates: {
        readAcceptedUpdateStatus: async (jobId) => {
          assert.equal(jobId, "job-100");

          return {
            jobId,
            operation: "players",
            state: "running",
            source: "runtime",
            message: "running in background",
            requestedAt: "2026-03-21T10:00:00.000Z",
            startedAt: "2026-03-21T10:00:01.000Z",
            pollPath: "/updates/jobs/job-100",
            period: {
              dateFrom: "2026-03-01",
              dateTo: "2026-03-14",
            },
          };
        },
      },
      auth: {
        requireAuthenticatedUser: async () => ({
          login: "admin",
        }),
      },
    },
  );
  const payload = JSON.parse(response.body) as {
    data: {
      jobId: string;
      operation: string;
      state: string;
      pollPath: string;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(payload.data.jobId, "job-100");
  assert.equal(payload.data.operation, "players");
  assert.equal(payload.data.state, "running");
  assert.equal(payload.data.pollPath, "/updates/jobs/job-100");
});

test("POST /updates/competitions rejects periods longer than fourteen days", async () => {
  const response = await invokeRequest(
    "/updates/competitions",
    {
      method: "POST",
      headers: {
        authorization: "Bearer session-100",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        dateFrom: "2026-01-01",
        dateTo: "2026-01-16",
      }),
    },
    {
      auth: {
        requireAuthenticatedUser: async () => ({
          login: "admin",
        }),
      },
    },
  );
  const payload = JSON.parse(response.body) as {
    error: { code: string; message: string };
  };

  assert.equal(response.statusCode, 400);
  assert.equal(payload.error.code, "invalid_period");
  assert.match(payload.error.message, /14 days/);
});

test("POST /updates/courses accepts a period-free update command", async () => {
  const response = await invokeRequest(
    "/updates/courses",
    {
      method: "POST",
      headers: {
        authorization: "Bearer session-100",
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    },
    {
      updates: {
        executeCoursesUpdate: async () => ({
          operation: "courses",
          finalStatus: "completed_with_issues",
          source: "runtime",
          message: "Определили идентификаторы парков и сохранили корректные записи.",
          requestedAt: "2026-03-21T10:00:00.000Z",
          finishedAt: "2026-03-21T10:00:01.000Z",
          summary: {
            found: 3,
            created: 1,
            updated: 1,
            skipped: 1,
            errors: 1,
          },
          issues: [
            {
              code: "invalid_course_record",
              message: "broken payload",
              recoverable: true,
              stage: "validation",
              recordKey: "course:course-bad",
            },
          ],
        }),
      },
      auth: {
        requireAuthenticatedUser: async () => ({
          login: "admin",
        }),
      },
    },
  );
  const payload = JSON.parse(response.body) as {
    data: {
      operation: string;
      finalStatus: string;
      source: string;
      summary: {
        found: number;
        created: number;
        updated: number;
        skipped: number;
        errors: number;
      };
      issues: Array<{ code: string; recordKey?: string }>;
      period?: unknown;
    };
  };

  assert.equal(response.statusCode, 202);
  assert.equal(payload.data.operation, "courses");
  assert.equal(payload.data.finalStatus, "completed_with_issues");
  assert.equal(payload.data.source, "runtime");
  assert.deepEqual(payload.data.summary, {
    found: 3,
    created: 1,
    updated: 1,
    skipped: 1,
    errors: 1,
  });
  assert.equal(payload.data.issues.length, 1);
  assert.equal(payload.data.issues[0]?.recordKey, "course:course-bad");
  assert.equal(payload.data.period, undefined);
});

test("POST /updates/results accepts a period-based update command", async () => {
  const response = await invokeRequest(
    "/updates/results",
    {
      method: "POST",
      headers: {
        authorization: "Bearer session-100",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        dateFrom: "2026-04-01",
        dateTo: "2026-04-14",
      }),
    },
    {
      updates: {
        executeResultsUpdate: async (period) => ({
          operation: "results",
          finalStatus: "completed_with_issues",
          source: "runtime",
          message: "Устойчиво сохранили корректных игроков и результаты соревнований.",
          requestedAt: "2026-03-22T10:00:00.000Z",
          finishedAt: "2026-03-22T10:00:02.000Z",
          summary: {
            found: 5,
            created: 5,
            updated: 0,
            skipped: 2,
            errors: 2,
          },
          issues: [
            {
              code: "discgolfmetrix_http_error",
              message: "upstream unavailable",
              recoverable: true,
              stage: "transport",
              recordKey: "competition:competition-102",
            },
            {
              code: "invalid_player_record",
              message: "missing playerName",
              recoverable: true,
              stage: "validation",
              recordKey: "player:player-3",
            },
          ],
          diagnostics: {
            transport: {
              summary: {
                found: 2,
                created: 0,
                updated: 0,
                skipped: 1,
                errors: 1,
              },
              issues: [
                {
                  code: "discgolfmetrix_http_error",
                  message: "upstream unavailable",
                  recoverable: true,
                  stage: "transport",
                  recordKey: "competition:competition-102",
                },
              ],
            },
            players: {
              summary: {
                found: 2,
                created: 2,
                updated: 0,
                skipped: 1,
                errors: 1,
              },
              issues: [
                {
                  code: "invalid_player_record",
                  message: "missing playerName",
                  recoverable: true,
                  stage: "validation",
                  recordKey: "player:player-3",
                },
              ],
            },
            results: {
              summary: {
                found: 3,
                created: 3,
                updated: 0,
                skipped: 0,
                errors: 0,
              },
              issues: [],
            },
          },
          period,
        }),
      },
      auth: {
        requireAuthenticatedUser: async () => ({
          login: "admin",
        }),
      },
    },
  );
  const payload = JSON.parse(response.body) as {
    data: {
      operation: string;
      finalStatus: string;
      source: string;
      summary: {
        found: number;
        created: number;
        updated: number;
        skipped: number;
        errors: number;
      };
      issues: Array<{ code: string; recordKey?: string }>;
      diagnostics?: {
        players?: { summary: { created: number } };
        results?: { summary: { found: number } };
      };
      period?: { dateFrom: string; dateTo: string };
    };
  };

  assert.equal(response.statusCode, 202);
  assert.equal(payload.data.operation, "results");
  assert.equal(payload.data.finalStatus, "completed_with_issues");
  assert.equal(payload.data.source, "runtime");
  assert.deepEqual(payload.data.summary, {
    found: 5,
    created: 5,
    updated: 0,
    skipped: 2,
    errors: 2,
  });
  assert.equal(payload.data.issues.length, 2);
  assert.equal(payload.data.issues[0]?.recordKey, "competition:competition-102");
  assert.equal(payload.data.diagnostics?.players?.summary.created, 2);
  assert.equal(payload.data.diagnostics?.results?.summary.found, 3);
  assert.deepEqual(payload.data.period, {
    dateFrom: "2026-04-01",
    dateTo: "2026-04-14",
  });
});

test("POST /updates/results invalidates read cache for subsequent projections", async () => {
  let listResultsCalls = 0;
  const handler = createApiRequestHandler({
    results: {
      listResults: async () => {
        listResultsCalls += 1;
        return [
          {
            competitionId: "competition-100",
            playerId: "player-100",
            competitionName: "Spring Open",
            playerName: "Ivan Ivanov",
            className: "MPO",
            sum: 54,
            diff: -6,
            dnf: false,
            seasonPoints: 80,
          },
        ];
      },
    },
    auth: {
      requireAuthenticatedUser: async () => ({
        login: "admin",
      }),
    },
    updates: {
      executeResultsUpdate: async () => ({
        operation: "results",
        finalStatus: "completed",
        source: "runtime",
        message: "ok",
        requestedAt: "2026-04-10T10:00:00.000Z",
        finishedAt: "2026-04-10T10:00:01.000Z",
        summary: {
          found: 1,
          created: 1,
          updated: 0,
          skipped: 0,
          errors: 0,
        },
        issues: [],
        period: {
          dateFrom: "2026-01-01",
          dateTo: "2026-01-14",
        },
      }),
    },
  });

  const firstListResponse = await invokeRequestWithHandler(handler, "/results");
  const secondListResponse = await invokeRequestWithHandler(handler, "/results");
  const updateResponse = await invokeRequestWithHandler(handler, "/updates/results", {
    method: "POST",
    headers: {
      authorization: "Bearer token-200",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      dateFrom: "2026-01-01",
      dateTo: "2026-01-14",
      overwriteExisting: true,
    }),
  });
  const thirdListResponse = await invokeRequestWithHandler(handler, "/results");

  assert.equal(firstListResponse.statusCode, 200);
  assert.equal(secondListResponse.statusCode, 200);
  assert.equal(updateResponse.statusCode, 202);
  assert.equal(thirdListResponse.statusCode, 200);
  assert.equal(listResultsCalls, 2);
});

test("POST /updates/players accepts a period-based update command", async () => {
  const response = await invokeRequest(
    "/updates/players",
    {
      method: "POST",
      headers: {
        authorization: "Bearer session-100",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        dateFrom: "2026-04-01",
        dateTo: "2026-04-14",
      }),
    },
    {
      updates: {
        executePlayersUpdate: async (period) => ({
          operation: "players",
          finalStatus: "completed_with_issues",
          source: "runtime",
          message:
            "Получили результаты, сохранили игроков и результаты соревнований и вернули раздельную диагностику по обеим сущностям.",
          requestedAt: "2026-03-22T10:00:00.000Z",
          finishedAt: "2026-03-22T10:00:02.000Z",
          summary: {
            found: 3,
            created: 2,
            updated: 0,
            skipped: 3,
            errors: 3,
          },
          issues: [
            {
              code: "invalid_player_record",
              message: "missing playerName",
              recoverable: true,
              stage: "validation",
              recordKey: "player:player-2",
            },
            {
              code: "invalid_competition_result_record",
              message: "missing sum",
              recoverable: true,
              stage: "validation",
              recordKey: "competition:competition-101:player:player-2",
            },
          ],
          diagnostics: {
            players: {
              summary: {
                found: 2,
                created: 2,
                updated: 0,
                skipped: 1,
                errors: 1,
              },
              issues: [
                {
                  code: "invalid_player_record",
                  message: "missing playerName",
                  recoverable: true,
                  stage: "validation",
                  recordKey: "player:player-2",
                },
              ],
            },
            results: {
              summary: {
                found: 1,
                created: 0,
                updated: 0,
                skipped: 2,
                errors: 2,
              },
              issues: [
                {
                  code: "invalid_competition_result_record",
                  message: "missing sum",
                  recoverable: true,
                  stage: "validation",
                  recordKey: "competition:competition-101:player:player-2",
                },
              ],
            },
          },
          period,
        }),
      },
      auth: {
        requireAuthenticatedUser: async () => ({
          login: "admin",
        }),
      },
    },
  );
  const payload = JSON.parse(response.body) as {
    data: {
      operation: string;
      finalStatus: string;
      source: string;
      summary: {
        found: number;
        created: number;
        updated: number;
        skipped: number;
        errors: number;
      };
      issues: Array<{ code: string; recordKey?: string }>;
      diagnostics?: {
        players?: { summary: { created: number } };
        results?: { summary: { skipped: number } };
      };
      period?: { dateFrom: string; dateTo: string };
    };
  };

  assert.equal(response.statusCode, 202);
  assert.equal(payload.data.operation, "players");
  assert.equal(payload.data.finalStatus, "completed_with_issues");
  assert.equal(payload.data.source, "runtime");
  assert.deepEqual(payload.data.summary, {
    found: 3,
    created: 2,
    updated: 0,
    skipped: 3,
    errors: 3,
  });
  assert.equal(payload.data.issues.length, 2);
  assert.equal(payload.data.diagnostics?.players?.summary.created, 2);
  assert.equal(payload.data.diagnostics?.results?.summary.skipped, 2);
  assert.equal(payload.data.issues[0]?.recordKey, "player:player-2");
  assert.deepEqual(payload.data.period, {
    dateFrom: "2026-04-01",
        dateTo: "2026-04-14",
  });
});

test("GET /users requires auth and returns the configured logins list", async () => {
  const response = await invokeRequest(
    "/users",
    {
      headers: {
        authorization: "Bearer session-100",
      },
    },
    {
      auth: {
        requireAuthenticatedUser: async (sessionToken) => {
          assert.equal(sessionToken, "session-100");

          return {
            login: "admin",
          };
        },
      },
      users: {
        listUsers: async () => [
          {
            login: "admin",
            createdAt: "2026-03-24T08:00:00.000Z",
          },
        ],
      },
    },
  );
  const payload = JSON.parse(response.body) as {
    data: Array<{
      login: string;
      createdAt: string;
    }>;
    meta: {
      count: number;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(payload.meta.count, 1);
  assert.equal(payload.data[0]?.login, "admin");
});

test("period-based update routes validate missing date fields", async () => {
  const response = await invokeRequest(
    "/updates/results",
    {
      method: "POST",
      headers: {
        authorization: "Bearer session-100",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        dateFrom: "2026-01-01",
      }),
    },
    {
      auth: {
        requireAuthenticatedUser: async () => ({
          login: "admin",
        }),
      },
    },
  );

  assert.equal(response.statusCode, 400);
  assert.deepEqual(JSON.parse(response.body), {
    error: {
      code: "invalid_period",
      message: "Both dateFrom and dateTo are required for this update scenario",
    },
  });
});

test("period-based update routes reject impossible calendar dates", async () => {
  const response = await invokeRequest(
    "/updates/competitions",
    {
      method: "POST",
      headers: {
        authorization: "Bearer session-100",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        dateFrom: "2026-02-31",
        dateTo: "2026-03-02",
      }),
    },
    {
      auth: {
        requireAuthenticatedUser: async () => ({
          login: "admin",
        }),
      },
    },
  );

  assert.equal(response.statusCode, 400);
  assert.deepEqual(JSON.parse(response.body), {
    error: {
      code: "invalid_period",
      message: "Field dateFrom must use YYYY-MM-DD format",
    },
  });
});

test("unknown routes return the shared error envelope", async () => {
  const response = await invokeRequest("/missing-route");
  const payload = JSON.parse(response.body) as {
    error: { code: string; message: string };
  };

  assert.equal(response.statusCode, 404);
  assert.equal(response.headers.get("Content-Type"), "application/json; charset=utf-8");
  assert.deepEqual(payload, {
    error: {
      code: "not_found",
      message: "Route not found",
    },
  });
});

test("internal errors are sanitized in the API response", async () => {
  const routes: RouteDefinition[] = [
    {
      method: "GET",
      path: "/boom",
      handler: () => {
        throw new Error("db password leaked");
      },
    },
  ];
  const handler = createRouter(routes);
  const headers = new Map<string, string>();
  let body = "";
  let headersSent = false;
  let writableEnded = false;

  const req = {
    method: "GET",
    url: "/boom",
    headers: { host: "localhost" },
  } as IncomingMessage;

  const res = {
    statusCode: 200,
    get headersSent() {
      return headersSent;
    },
    get writableEnded() {
      return writableEnded;
    },
    setHeader(name: string, value: string) {
      headers.set(name, value);
      headersSent = true;
    },
    end(chunk?: string) {
      body = chunk ?? "";
      writableEnded = true;
    },
  } as unknown as ServerResponse;

  await handler(req, res);

  const payload = JSON.parse(body) as { error: { code: string; message: string } };
  assert.equal(res.statusCode, 500);
  assert.equal(headers.get("Content-Type"), "application/json; charset=utf-8");
  assert.equal(payload.error.code, "internal_error");
  assert.equal(payload.error.message, "Internal server error");
});

test("router does not write a second error response after headers are sent", async () => {
  const routes: RouteDefinition[] = [
    {
      method: "GET",
      path: "/partial",
      handler: ({ res }) => {
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify({ data: { ok: true } }));
        throw new Error("late failure");
      },
    },
  ];
  const handler = createRouter(routes);
  let writeAttempts = 0;
  let body = "";
  let headersSent = false;
  let writableEnded = false;

  const req = {
    method: "GET",
    url: "/partial",
    headers: { host: "localhost" },
  } as IncomingMessage;

  const res = {
    statusCode: 200,
    get headersSent() {
      return headersSent;
    },
    get writableEnded() {
      return writableEnded;
    },
    setHeader() {
      headersSent = true;
    },
    end(chunk?: string) {
      writeAttempts += 1;
      body = chunk ?? "";
      writableEnded = true;
    },
  } as unknown as ServerResponse;

  await handler(req, res);

  assert.equal(writeAttempts, 1);
  assert.deepEqual(JSON.parse(body), { data: { ok: true } });
});
