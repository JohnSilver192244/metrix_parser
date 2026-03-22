import assert from "node:assert/strict";
import test from "node:test";

import { runResultsUpdateJob } from "./results-update-job";
import { createMockResponse } from "../test-support/mock-response";

test("runResultsUpdateJob returns an empty successful summary when no competitions match the period", async () => {
  const result = await runResultsUpdateJob(
    {
      dateFrom: "2026-04-01",
      dateTo: "2026-04-30",
    },
    {
      baseUrl: "https://discgolfmetrix.com",
      countryCode: "RU",
      apiCode: "secret-code",
      readCompetitions: async () => ({
        competitions: [],
        skippedCount: 0,
        issues: [],
      }),
      fetchImpl: async () => {
        throw new Error("fetch should not be called");
      },
    },
  );

  assert.equal(result.finalStatus, "completed");
  assert.deepEqual(result.summary, {
    found: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
  });
  assert.equal(result.fetchedResults?.length, 0);
});

test("runResultsUpdateJob fetches results for multiple competitions and isolates partial failures", async () => {
  const result = await runResultsUpdateJob(
    {
      dateFrom: "2026-04-01",
      dateTo: "2026-04-30",
    },
    {
      baseUrl: "https://discgolfmetrix.com",
      countryCode: "RU",
      apiCode: "secret-code",
      readCompetitions: async () => ({
        competitions: [
          {
            competitionId: "competition-101",
            metrixId: "metrix-101",
            competitionDate: "2026-04-10",
          },
          {
            competitionId: "competition-102",
            metrixId: null,
            competitionDate: "2026-04-11",
          },
        ],
        skippedCount: 0,
        issues: [],
      }),
      fetchImpl: async (input) => {
        const url = String(input);

        if (url.includes("competition_id=competition-101")) {
          return createMockResponse(
            JSON.stringify({
              results: [{ playerId: "player-1", playerName: "Ivan" }],
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }

        return createMockResponse("upstream unavailable", { status: 503 });
      },
    },
  );

  assert.equal(result.finalStatus, "completed_with_issues");
  assert.deepEqual(result.summary, {
    found: 2,
    created: 0,
    updated: 0,
    skipped: 1,
    errors: 1,
  });
  assert.equal(result.fetchedResults?.length, 1);
  assert.equal(result.issues.length, 1);
  assert.equal(result.issues[0]?.recordKey, "competition:competition-102");
});
