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

  async findByCompetitionIds(competitionIds: string[]) {
    return this.rows.filter((row) => competitionIds.includes(row.competition_id));
  }

  async findByMetrixIds(metrixIds: string[]) {
    return this.rows.filter((row) => row.metrix_id !== null && metrixIds.includes(row.metrix_id));
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

  async upsert(records: StoredCompetitionRecord[]) {
    return records.map((record) => {
      const existing = this.rows.find(
        (row) => row.competition_id === record.competition_id,
      );

      if (existing) {
        const updated = { id: existing.id, ...record };
        this.rows[this.rows.findIndex((row) => row.id === existing.id)] = updated;
        return updated;
      }

      const created = { id: this.nextId++, ...record };
      this.rows.push(created);
      return created;
    });
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
                CourseID: "45374",
              },
              {
                ID: "102",
                Name: "Winter Cup",
                Date: "2026-01-20",
                CountryCode: "RU",
                CourseID: "45375",
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
                CourseID: "45374",
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

test("runCompetitionsUpdateJob filters out competitions with excluded name fragments", async () => {
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
                CourseID: "45374",
              },
              {
                ID: "105",
                Name: "Winter Master Class",
                Date: "2026-01-18",
                CountryCode: "RU",
                CourseID: "45378",
              },
              {
                ID: "106",
                Name: "Парный ДАБЛС уикенд",
                Date: "2026-01-19",
                CountryCode: "RU",
                CourseID: "45379",
              },
              {
                ID: "107",
                Name: "Мастер‑класс по паттингу",
                Date: "2026-01-20",
                CountryCode: "RU",
                CourseID: "45380",
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    },
  );

  assert.equal(result.finalStatus, "completed");
  assert.deepEqual(result.summary, {
    found: 4,
    created: 1,
    updated: 0,
    skipped: 0,
    errors: 0,
  });
  assert.equal(result.mappedCompetitionsCount, 1);
  assert.equal(result.issues.length, 0);
});

test("runCompetitionsUpdateJob skips competitions with fewer than eight players and keeps competitions with eight players", async () => {
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
                PlayersCount: "16",
                CourseID: "45374",
              },
              {
                ID: "103",
                Name: "Small Cup",
                Date: "2026-01-16",
                CountryCode: "RU",
                PlayersCount: "7",
                CourseID: "45376",
              },
              {
                ID: "104",
                Name: "Borderline Cup",
                Date: "2026-01-17",
                CountryCode: "RU",
                PlayersCount: "8",
                CourseID: "45377",
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
    created: 2,
    updated: 0,
    skipped: 1,
    errors: 0,
  });
  assert.equal(result.mappedCompetitionsCount, 2);
  assert.equal(result.issues.length, 1);
  assert.equal(result.issues[0]?.code, "competition_zero_players");
  assert.equal(result.issues[0]?.message, "Меньше 8 игроков");
  assert.equal(result.issues[0]?.recordKey, "competition:103");
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
                CourseID: "45374",
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
      overwriteExisting: true,
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
                CourseID: "45374",
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

test("runCompetitionsUpdateJob reports skip reasons for existing competitions when overwrite is disabled", async () => {
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
      overwriteExisting: true,
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
                CourseID: "45374",
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
                CourseID: "45374",
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    },
  );

  assert.equal(result.finalStatus, "completed_with_issues");
  assert.deepEqual(result.summary, {
    found: 1,
    created: 0,
    updated: 0,
    skipped: 1,
    errors: 0,
  });
  assert.equal(result.skipReasons?.length, 1);
  assert.equal(
    result.skipReasons?.[0]?.code,
    "competition_existing_record_skipped",
  );
});

test("runCompetitionsUpdateJob skips unchanged competitions when overwrite is enabled", async () => {
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
      overwriteExisting: true,
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
                CourseID: "45374",
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
      overwriteExisting: true,
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
                CourseID: "45374",
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    },
  );

  assert.equal(result.finalStatus, "completed_with_issues");
  assert.deepEqual(result.summary, {
    found: 1,
    created: 0,
    updated: 0,
    skipped: 1,
    errors: 0,
  });
  assert.equal(result.skipReasons?.[0]?.code, "competition_unchanged_skipped");
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
