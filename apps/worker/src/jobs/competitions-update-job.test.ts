import assert from "node:assert/strict";
import test from "node:test";

import { runCompetitionsUpdateJob } from "./competitions-update-job";

test("runCompetitionsUpdateJob reports fetched competitions in the shared update result", async () => {
  const result = await runCompetitionsUpdateJob(
    {
      dateFrom: "2026-01-01",
      dateTo: "2026-01-31",
    },
    {
      baseUrl: "https://discgolfmetrix.com",
      countryCode: "EE",
      apiCode: "secret-code",
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            competitions: [
              { competitionId: "101", competitionName: "Moscow Open" },
              { competitionId: "102", competitionName: "Winter Cup" },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    },
  );

  assert.equal(result.finalStatus, "completed");
  assert.deepEqual(result.summary, {
    found: 2,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
  });
  assert.equal(result.issues.length, 0);
  assert.equal(result.fetchedPayload?.records.length, 2);
});

test("runCompetitionsUpdateJob includes external API failures in the shared update result", async () => {
  const result = await runCompetitionsUpdateJob(
    {
      dateFrom: "2026-01-01",
      dateTo: "2026-01-31",
    },
    {
      baseUrl: "https://discgolfmetrix.com",
      countryCode: "EE",
      apiCode: "secret-code",
      fetchImpl: async () => new Response("upstream unavailable", { status: 503 }),
    },
  );

  assert.equal(result.finalStatus, "failed");
  assert.deepEqual(result.summary, {
    found: 0,
    created: 0,
    updated: 0,
    skipped: 1,
    errors: 1,
  });
  assert.equal(result.issues.length, 1);
  assert.equal(result.issues[0]?.code, "discgolfmetrix_http_error");
  assert.equal(result.issues[0]?.stage, "transport");
});
