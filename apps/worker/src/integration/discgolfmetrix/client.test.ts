import assert from "node:assert/strict";
import test from "node:test";

import {
  DiscGolfMetrixClientError,
  buildCompetitionsRequestUrl,
  createDiscGolfMetrixClient,
} from "./index";
import { createMockResponse } from "../../test-support/mock-response";

test("buildCompetitionsRequestUrl maps shared period fields to DiscGolfMetrix request params", () => {
  const url = buildCompetitionsRequestUrl(
    "https://discgolfmetrix.com",
    "EE",
    "secret-code",
    {
      period: {
        dateFrom: "2026-01-01",
        dateTo: "2026-01-31",
      },
    },
  );

  assert.equal(
    url,
    "https://discgolfmetrix.com/api.php?content=competitions&country_code=EE&date1=2026-01-01&date2=2026-01-31&code=secret-code",
  );
});

test("client returns raw competition records in a parsing-ready envelope", async () => {
  const client = createDiscGolfMetrixClient({
    baseUrl: "https://discgolfmetrix.com",
    countryCode: "EE",
    apiCode: "secret-code",
    fetchImpl: async () =>
      createMockResponse(
        JSON.stringify({
          competitions: [
            { competitionId: 101, name: "Moscow Open" },
            { competitionId: 102, name: "Saint Petersburg Cup" },
          ],
          page: 1,
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      ),
  });

  const result = await client.fetchCompetitions({
    period: {
      dateFrom: "2026-01-01",
      dateTo: "2026-01-31",
    },
  });

  assert.equal(result.records.length, 2);
  assert.equal(result.rawPayload.page, 1);
  assert.equal(result.records[0]?.competitionId, 101);
  assert.ok(result.sourceUrl.includes("date1=2026-01-01"));
  assert.ok(result.sourceUrl.includes("country_code=EE"));
});

test("client throws predictable HTTP errors for DiscGolfMetrix failures", async () => {
  const client = createDiscGolfMetrixClient({
    baseUrl: "https://discgolfmetrix.com",
    countryCode: "EE",
    apiCode: "secret-code",
    fetchImpl: async () => createMockResponse("nope", { status: 502 }),
  });

  await assert.rejects(
    () =>
      client.fetchCompetitions({
        period: {
          dateFrom: "2026-01-01",
          dateTo: "2026-01-31",
        },
      }),
    (error: unknown) =>
      error instanceof DiscGolfMetrixClientError &&
      error.code === "discgolfmetrix_http_error",
  );
});

test("client throws predictable parse errors for non-JSON DiscGolfMetrix payloads", async () => {
  const client = createDiscGolfMetrixClient({
    baseUrl: "https://discgolfmetrix.com",
    countryCode: "EE",
    apiCode: "secret-code",
    fetchImpl: async () =>
      createMockResponse("<html><body>temporary upstream page</body></html>", {
        status: 200,
        headers: {
          "content-type": "text/html; charset=utf-8",
        },
      }),
  });

  await assert.rejects(
    () =>
      client.fetchCompetitions({
        period: {
          dateFrom: "2026-01-01",
          dateTo: "2026-01-31",
        },
      }),
    (error: unknown) =>
      error instanceof DiscGolfMetrixClientError &&
      error.code === "discgolfmetrix_parse_error" &&
      error.message.includes("Response preview: <html><body>temporary upstream page</body></html>"),
  );
});
