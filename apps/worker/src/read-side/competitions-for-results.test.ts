import assert from "node:assert/strict";
import test from "node:test";

import { createCompetitionsForResultsReader } from "./competitions-for-results";

test("competitions reader returns saved competitions for the requested period", async () => {
  const reader = createCompetitionsForResultsReader({
    async listCompetitionsForPeriod() {
      return [
        {
          competition_id: "competition-101",
          metrix_id: "metrix-101",
          competition_date: "2026-04-10",
        },
        {
          competition_id: "competition-102",
          metrix_id: null,
          competition_date: "2026-04-11",
        },
      ];
    },
  });

  const result = await reader.readCompetitions({
    dateFrom: "2026-04-01",
    dateTo: "2026-04-30",
  });

  assert.equal(result.skippedCount, 0);
  assert.equal(result.issues.length, 0);
  assert.deepEqual(result.competitions, [
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
  ]);
});

test("competitions reader skips broken rows with no stable identifiers", async () => {
  const reader = createCompetitionsForResultsReader({
    async listCompetitionsForPeriod() {
      return [
        {
          competition_id: null,
          metrix_id: null,
          competition_date: "2026-04-12",
        },
      ];
    },
  });

  const result = await reader.readCompetitions({
    dateFrom: "2026-04-01",
    dateTo: "2026-04-30",
  });

  assert.equal(result.competitions.length, 0);
  assert.equal(result.skippedCount, 1);
  assert.equal(result.issues[0]?.code, "competition_missing_identity");
});

test("competitions reader does not substitute metrix_id into competition_id", async () => {
  const reader = createCompetitionsForResultsReader({
    async listCompetitionsForPeriod() {
      return [
        {
          competition_id: null,
          metrix_id: "metrix-101",
          competition_date: "2026-04-12",
        },
      ];
    },
  });

  const result = await reader.readCompetitions({
    dateFrom: "2026-04-01",
    dateTo: "2026-04-30",
  });

  assert.equal(result.competitions.length, 0);
  assert.equal(result.skippedCount, 1);
  assert.equal(
    result.issues[0]?.message,
    "Saved competition row is missing competition_id required for results fetch.",
  );
});
