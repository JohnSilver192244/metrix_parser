import assert from "node:assert/strict";
import test from "node:test";

import type { CompetitionDbRecord } from "@metrix-parser/shared-types";

import { runCompetitionsUpdateJob } from "./competitions-update-job";
import { createMockResponse } from "../test-support/mock-response";
import {
  createCompetitionsRepository,
  type StoredCompetitionRecord,
} from "../persistence/competitions-repository";

class InMemoryRepositoryAdapter {
  private rows: Array<CompetitionDbRecord & { id: number }> = [];
  private nextId = 1;

  async findByCompetitionId(competitionId: string) {
    return this.rows.find((row) => row.competition_id === competitionId) ?? null;
  }

  async findByMetrixId(metrixId: string) {
    return this.rows.find((row) => row.metrix_id === metrixId) ?? null;
  }

  async insert(record: StoredCompetitionRecord) {
    const created = { id: this.nextId++, ...record };
    this.rows.push(created);
    return created;
  }

  async update(id: number, record: StoredCompetitionRecord) {
    const index = this.rows.findIndex((row) => row.id === id);
    const updated = { id, ...record };
    this.rows[index] = updated;
    return updated;
  }
}

test("runCompetitionsUpdateJob reports fetched competitions in the shared update result", async () => {
  const repository = createCompetitionsRepository(new InMemoryRepositoryAdapter());
  const result = await runCompetitionsUpdateJob(
    {
      dateFrom: "2026-01-01",
      dateTo: "2026-01-31",
    },
    {
      baseUrl: "https://discgolfmetrix.com",
      countryCode: "RU",
      apiCode: "secret-code",
      repository,
      fetchImpl: async () =>
        createMockResponse(
          JSON.stringify({
            competitions: [
              {
                ID: "101",
                Name: "Moscow Open",
                Date: "2026-01-15",
                CountryCode: "RU",
              },
              {
                ID: "102",
                Name: "Winter Cup",
                Date: "2026-01-20",
                CountryCode: "RU",
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    },
  );

  assert.equal(result.finalStatus, "completed");
  assert.deepEqual(result.summary, {
    found: 2,
    created: 2,
    updated: 0,
    skipped: 0,
    errors: 0,
  });
  assert.equal(result.issues.length, 0);
  assert.equal(result.fetchedPayload?.records.length, 2);
  assert.equal(result.mappedCompetitionsCount, 2);
});

test("runCompetitionsUpdateJob keeps valid Russian competitions and reports invalid Russian records as skipped", async () => {
  const repository = createCompetitionsRepository(new InMemoryRepositoryAdapter());
  const result = await runCompetitionsUpdateJob(
    {
      dateFrom: "2026-01-01",
      dateTo: "2026-01-31",
    },
    {
      baseUrl: "https://discgolfmetrix.com",
      countryCode: "RU",
      apiCode: "secret-code",
      repository,
      fetchImpl: async () =>
        createMockResponse(
          JSON.stringify({
            competitions: [
              {
                ID: "101",
                Name: "Moscow Open",
                Date: "2026-01-15",
                CountryCode: "RU",
              },
              {
                ID: "bad-1",
                Name: "Broken Cup",
                CountryCode: "RU",
              },
              {
                ID: "201",
                Name: "Tallinn Open",
                Date: "2026-01-22",
                CountryCode: "EE",
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    },
  );

  assert.equal(result.finalStatus, "completed_with_issues");
  assert.deepEqual(result.summary, {
    found: 3,
    created: 1,
    updated: 0,
    skipped: 1,
    errors: 1,
  });
  assert.equal(result.mappedCompetitionsCount, 1);
  assert.equal(result.issues.length, 1);
  assert.equal(result.issues[0]?.code, "invalid_competition_record");
});

test("runCompetitionsUpdateJob reports repeat runs as updates instead of duplicate inserts", async () => {
  const repository = createCompetitionsRepository(new InMemoryRepositoryAdapter());

  await runCompetitionsUpdateJob(
    {
      dateFrom: "2026-01-01",
      dateTo: "2026-01-31",
    },
    {
      baseUrl: "https://discgolfmetrix.com",
      countryCode: "RU",
      apiCode: "secret-code",
      repository,
      fetchImpl: async () =>
        createMockResponse(
          JSON.stringify({
            competitions: [
              {
                ID: "101",
                Name: "Moscow Open",
                Date: "2026-01-15",
                CountryCode: "RU",
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    },
  );

  const result = await runCompetitionsUpdateJob(
    {
      dateFrom: "2026-01-01",
      dateTo: "2026-01-31",
    },
    {
      baseUrl: "https://discgolfmetrix.com",
      countryCode: "RU",
      apiCode: "secret-code",
      repository,
      fetchImpl: async () =>
        createMockResponse(
          JSON.stringify({
            competitions: [
              {
                ID: "101",
                Name: "Moscow Open Updated",
                Date: "2026-01-15",
                CountryCode: "RU",
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    },
  );

  assert.equal(result.finalStatus, "completed");
  assert.deepEqual(result.summary, {
    found: 1,
    created: 0,
    updated: 1,
    skipped: 0,
    errors: 0,
  });
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
      fetchImpl: async () =>
        createMockResponse("upstream unavailable", { status: 503 }),
    },
  );

  assert.equal(result.finalStatus, "failed");
  assert.deepEqual(result.summary, {
    found: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: 1,
  });
  assert.equal(result.issues.length, 1);
  assert.equal(result.issues[0]?.code, "discgolfmetrix_http_error");
  assert.equal(result.issues[0]?.stage, "transport");
});
