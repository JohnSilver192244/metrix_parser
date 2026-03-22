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
          message: "Worker selected competitions and fetched raw result payloads.",
          requestedAt: "2026-03-22T10:00:00.000Z",
          finishedAt: "2026-03-22T10:00:02.000Z",
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
  assert.equal(payload.data.operation, "results");
  assert.equal(payload.data.finalStatus, "completed_with_issues");
  assert.equal(payload.data.source, "runtime");
  assert.deepEqual(payload.data.summary, {
    found: 2,
    created: 0,
    updated: 0,
    skipped: 1,
    errors: 1,
  });
  assert.equal(payload.data.issues.length, 1);
  assert.equal(payload.data.issues[0]?.recordKey, "competition:competition-102");
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
