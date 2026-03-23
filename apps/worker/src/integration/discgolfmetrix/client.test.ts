import assert from "node:assert/strict";
import test from "node:test";

import {
  DiscGolfMetrixClientError,
  buildCourseRequestUrl,
  buildCompetitionsRequestUrl,
  buildResultsRequestUrl,
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

test("buildCourseRequestUrl maps course id to DiscGolfMetrix request params", () => {
  const url = buildCourseRequestUrl("https://discgolfmetrix.com", "secret-code", {
    courseId: "course-101",
  });

  assert.equal(
    url,
    "https://discgolfmetrix.com/api.php?content=course&id=course-101&code=secret-code",
  );
});

test("buildResultsRequestUrl maps competition identifiers to DiscGolfMetrix request params", () => {
  const url = buildResultsRequestUrl("https://discgolfmetrix.com", "secret-code", {
    competitionId: "competition-101",
    metrixId: "metrix-101",
  });

  assert.equal(
    url,
    "https://discgolfmetrix.com/api.php?content=result&id=competition-101&code=secret-code",
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
            { ID: 101, Name: "Moscow Open" },
            { ID: 102, Name: "Saint Petersburg Cup" },
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
  assert.equal(result.records[0]?.ID, 101);
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

test("client returns raw course records in a parsing-ready envelope", async () => {
  const client = createDiscGolfMetrixClient({
    baseUrl: "https://discgolfmetrix.com",
    countryCode: "EE",
    apiCode: "secret-code",
    fetchImpl: async () =>
      createMockResponse(
        JSON.stringify({
          course: {
            ID: "course-101",
            Name: "Tiraz Park",
          },
          baskets: [{ Par: "3" }, { Par: "4" }],
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      ),
  });

  const result = await client.fetchCourse({
    courseId: "course-101",
  });

  const nestedCourse = result.record.course as { ID?: string } | undefined;
  assert.equal(result.courseId, "course-101");
  assert.equal(nestedCourse?.ID, "course-101");
  assert.ok(result.sourceUrl.includes("id=course-101"));
});

test("client returns raw results payloads in a parsing-ready envelope", async () => {
  const client = createDiscGolfMetrixClient({
    baseUrl: "https://discgolfmetrix.com",
    countryCode: "EE",
    apiCode: "secret-code",
    fetchImpl: async () =>
      createMockResponse(
        JSON.stringify({
          Competition: {
            Results: [
              { UserID: "player-1", Name: "Ivan" },
              { UserID: "player-2", Name: "Petr" },
            ],
          },
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      ),
  });

  const result = await client.fetchResults({
    competitionId: "competition-101",
    metrixId: "metrix-101",
  });

  assert.equal(result.competitionId, "competition-101");
  assert.equal(result.metrixId, "metrix-101");
  const competitionSection = result.rawPayload.Competition as
    | { Results?: unknown[] }
    | undefined;
  assert.equal(
    Array.isArray(competitionSection?.Results)
      ? competitionSection.Results.length
      : 0,
    2,
  );
  assert.ok(result.sourceUrl.includes("content=result"));
  assert.ok(result.sourceUrl.includes("id=competition-101"));
});

test("client rejects results payloads without a recognizable results collection", async () => {
  const client = createDiscGolfMetrixClient({
    baseUrl: "https://discgolfmetrix.com",
    countryCode: "EE",
    apiCode: "secret-code",
    fetchImpl: async () =>
      createMockResponse(
        JSON.stringify({
          status: "ok",
          message: "no standings yet",
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      ),
  });

  await assert.rejects(
    () =>
      client.fetchResults({
        competitionId: "competition-101",
      }),
    (error: unknown) =>
      error instanceof DiscGolfMetrixClientError &&
      error.code === "discgolfmetrix_parse_error",
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
