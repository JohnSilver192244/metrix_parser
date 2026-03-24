import assert from "node:assert/strict";
import test from "node:test";
import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";

import { createApiRequestHandler } from "./app";
import { createRouter, type RouteDefinition } from "./lib/router";
import type { ApiModuleDependencies } from "./modules";

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
            recordType: "tournament",
            playersCount: 48,
            metrixId: "metrix-102",
          },
          {
            competitionId: "competition-101",
            competitionName: "Saint Petersburg Cup",
            competitionDate: "2026-04-14",
            parentId: null,
            courseId: null,
            courseName: null,
            recordType: null,
            playersCount: null,
            metrixId: null,
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
      recordType: string | null;
      playersCount: number | null;
      metrixId: string | null;
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
    recordType: "tournament",
    playersCount: 48,
    metrixId: "metrix-102",
  });
  assert.deepEqual(payload.data[1], {
    competitionId: "competition-101",
    competitionName: "Saint Petersburg Cup",
    competitionDate: "2026-04-14",
    parentId: null,
    courseId: null,
    courseName: null,
    recordType: null,
    playersCount: null,
    metrixId: null,
  });
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
  });
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

test("GET /players returns persisted players via the API envelope", async () => {
  const response = await invokeRequest(
    "/players",
    {},
    {
      players: {
        listPlayers: async () => [
          {
            playerId: "player-100",
            playerName: "Ivan Ivanov",
            division: "MPO",
            rdga: true,
            competitionsCount: 3,
          },
          {
            playerId: "player-101",
            playerName: "Anna Petrova",
            division: null,
            rdga: null,
            competitionsCount: 1,
          },
        ],
      },
    },
  );
  const payload = JSON.parse(response.body) as {
    data: Array<{
      playerId: string;
      playerName: string;
      division: string | null;
      rdga: boolean | null;
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
    competitionsCount: 3,
  });
  assert.deepEqual(payload.data[1], {
    playerId: "player-101",
    playerName: "Anna Petrova",
    division: null,
    rdga: null,
    competitionsCount: 1,
  });
});

test("PUT /players updates editable player fields and returns the updated player", async () => {
  let receivedPayload:
    | {
        playerId: string;
        division: string | null;
        rdga: boolean | null;
      }
    | undefined;

  const response = await invokeRequest(
    "/players",
    {
      method: "PUT",
      body: JSON.stringify({
        playerId: "player-100",
        division: "MA2",
        rdga: false,
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
            competitionsCount: 3,
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
      competitionsCount?: number;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.deepEqual(receivedPayload, {
    playerId: "player-100",
    division: "MA2",
    rdga: false,
  });
  assert.deepEqual(payload.data, {
    playerId: "player-100",
    playerName: "Ivan Ivanov",
    division: "MA2",
    rdga: false,
    competitionsCount: 3,
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
            orderNumber: 1,
            dnf: false,
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
            orderNumber: 2,
            dnf: true,
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
      orderNumber: number;
      dnf: boolean;
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
    orderNumber: 1,
    dnf: false,
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
    orderNumber: 2,
    dnf: true,
  });
});

test("GET /results forwards competitionId filter to the results module", async () => {
  let receivedFilters:
    | {
        competitionId?: string;
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
              orderNumber: 1,
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
        "content-type": "application/json",
      },
      body: JSON.stringify({
        dateFrom: "2026-01-01",
        dateTo: "2026-01-31",
      }),
    },
    {
      updates: {
        executeCompetitionsUpdate: async (period) => ({
          operation: "competitions",
          finalStatus: "completed",
          source: "runtime",
          message: "Worker fetched and mapped competitions.",
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
    dateTo: "2026-01-31",
  });
});

test("POST /updates/courses accepts a period-free update command", async () => {
  const response = await invokeRequest(
    "/updates/courses",
    {
      method: "POST",
      headers: {
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
          message: "Worker discovered course ids and persisted valid park records.",
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
        "content-type": "application/json",
      },
      body: JSON.stringify({
        dateFrom: "2026-04-01",
        dateTo: "2026-04-30",
      }),
    },
    {
      updates: {
        executeResultsUpdate: async (period) => ({
          operation: "results",
          finalStatus: "completed_with_issues",
          source: "runtime",
          message: "Worker resiliently persisted valid players and competition results.",
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
    dateTo: "2026-04-30",
  });
});

test("POST /updates/players accepts a period-based update command", async () => {
  const response = await invokeRequest(
    "/updates/players",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        dateFrom: "2026-04-01",
        dateTo: "2026-04-30",
      }),
    },
    {
      updates: {
        executePlayersUpdate: async (period) => ({
          operation: "players",
          finalStatus: "completed_with_issues",
          source: "runtime",
          message:
            "Worker fetched result payloads, persisted players and competition results, and returned separate diagnostics for both entities.",
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
              message: "missing orderNumber",
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
                  message: "missing orderNumber",
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
    dateTo: "2026-04-30",
  });
});

test("period-based update routes validate missing date fields", async () => {
  const response = await invokeRequest("/updates/results", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      dateFrom: "2026-01-01",
    }),
  });

  assert.equal(response.statusCode, 400);
  assert.deepEqual(JSON.parse(response.body), {
    error: {
      code: "invalid_period",
      message: "Both dateFrom and dateTo are required for this update scenario",
    },
  });
});

test("period-based update routes reject impossible calendar dates", async () => {
  const response = await invokeRequest("/updates/competitions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      dateFrom: "2026-02-31",
      dateTo: "2026-03-02",
    }),
  });

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
