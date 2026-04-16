import assert from "node:assert/strict";
import test from "node:test";

import { createRouter, type RouteDefinition } from "../lib/router";
import {
  adaptNodeHandlerToCloudflareFetch,
  createCloudflareFetchHandler,
} from "./fetch-handler-spike";

test("Cloudflare fetch handler serves a representative read route through /competitions", async () => {
  const handler = createCloudflareFetchHandler({
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
          comment: null,
          recordType: "tournament",
          playersCount: 48,
          metrixId: "metrix-102",
          hasResults: true,
          seasonPoints: 186.4,
        },
      ],
    },
  });

  const response = await handler(new Request("https://example.com/competitions"));
  const payload = (await response.json()) as {
    data: Array<{ competitionId: string; competitionName: string }>;
    meta: { count: number; limit: number; offset: number };
  };

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "*");
  assert.equal(response.headers.get("Content-Type"), "application/json; charset=utf-8");
  assert.equal(payload.data[0]?.competitionId, "competition-102");
  assert.equal(payload.data[0]?.competitionName, "Moscow Spring Open");
  assert.equal(payload.meta.count, 1);
});

test("Cloudflare fetch handler serves a protected write route through /updates/competitions", async () => {
  const handler = createCloudflareFetchHandler({
    updates: {
      executeCompetitionsUpdate: async (period) => ({
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
          createdAt: "2026-01-01T00:00:00.000Z",
        };
      },
    },
  });

  const response = await handler(
    new Request("https://example.com/updates/competitions", {
      method: "POST",
      headers: {
        Authorization: "Bearer session-100",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        dateFrom: "2026-01-01",
        dateTo: "2026-01-31",
      }),
    }),
  );
  const payload = (await response.json()) as {
    data: {
      operation: string;
      finalStatus: string;
      period?: { dateFrom: string; dateTo: string };
    };
  };

  assert.equal(response.status, 202);
  assert.equal(payload.data.operation, "competitions");
  assert.equal(payload.data.finalStatus, "completed");
  assert.deepEqual(payload.data.period, {
    dateFrom: "2026-01-01",
    dateTo: "2026-01-31",
  });
});

test("Cloudflare fetch handler keeps internal error envelope path after setHeader without end", async () => {
  const routes: RouteDefinition[] = [
    {
      method: "GET",
      path: "/broken",
      handler: ({ res }) => {
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        throw new Error("boom");
      },
    },
  ];
  const handler = adaptNodeHandlerToCloudflareFetch(createRouter(routes));

  const response = await handler(new Request("https://example.com/broken"));
  const payload = (await response.json()) as {
    error: { code: string; message: string };
  };

  assert.equal(response.status, 500);
  assert.equal(payload.error.code, "internal_error");
  assert.equal(payload.error.message, "Internal server error");
});

test("Cloudflare fetch handler can run with request-scoped runtime env overrides", async () => {
  const handler = createCloudflareFetchHandler(undefined, () => ({
    supabaseUrl: "https://supabase.example",
    supabaseServiceRoleKey: "service-role-key",
  }));

  const response = await handler(new Request("https://example.com/health"));
  const payload = (await response.json()) as {
    data: { service: string; status: string };
  };

  assert.equal(response.status, 200);
  assert.equal(payload.data.service, "api");
  assert.equal(payload.data.status, "ok");
});
