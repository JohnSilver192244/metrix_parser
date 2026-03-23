import assert from "node:assert/strict";
import test from "node:test";

import {
  createCompetitionResultsRepository,
  type CompetitionResultRow,
  type CompetitionResultsPersistenceAdapter,
  type StoredCompetitionResultRecord,
} from "../persistence/competition-results-repository";
import { runResultsUpdateJob } from "./results-update-job";
import { createMockResponse } from "../test-support/mock-response";

class InMemoryCompetitionResultsAdapter
  implements CompetitionResultsPersistenceAdapter
{
  private rows: CompetitionResultRow[];
  private nextId: number;

  constructor(initialRows: CompetitionResultRow[] = []) {
    this.rows = [...initialRows];
    this.nextId = initialRows.reduce((maxId, row) => Math.max(maxId, row.id), 0) + 1;
  }

  async findByIdentity(
    competitionId: string,
    playerId: string,
    orderNumber: number,
  ): Promise<CompetitionResultRow | null> {
    return (
      this.rows.find(
        (row) =>
          row.competition_id === competitionId &&
          row.player_id === playerId &&
          row.order_number === orderNumber,
      ) ?? null
    );
  }

  async insert(record: StoredCompetitionResultRecord): Promise<CompetitionResultRow> {
    const created = { id: this.nextId++, ...record };
    this.rows.push(created);
    return created;
  }

  async update(
    id: number,
    record: StoredCompetitionResultRecord,
  ): Promise<CompetitionResultRow> {
    const index = this.rows.findIndex((row) => row.id === id);
    const updated = { id, ...record };
    this.rows[index] = updated;
    return updated;
  }

  snapshot() {
    return [...this.rows];
  }
}

test("runResultsUpdateJob returns an empty successful summary when no competitions match the period", async () => {
  const repository = createCompetitionResultsRepository(
    new InMemoryCompetitionResultsAdapter(),
  );
  const result = await runResultsUpdateJob(
    {
      dateFrom: "2026-04-01",
      dateTo: "2026-04-30",
    },
    {
      baseUrl: "https://discgolfmetrix.com",
      countryCode: "RU",
      apiCode: "secret-code",
      resultsRepository: repository,
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
  const adapter = new InMemoryCompetitionResultsAdapter();
  const repository = createCompetitionResultsRepository(adapter);
  const result = await runResultsUpdateJob(
    {
      dateFrom: "2026-04-01",
      dateTo: "2026-04-30",
    },
    {
      baseUrl: "https://discgolfmetrix.com",
      countryCode: "RU",
      apiCode: "secret-code",
      resultsRepository: repository,
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

        if (url.includes("id=competition-101")) {
          return createMockResponse(
            JSON.stringify({
              Competition: {
                Results: [
                  {
                    UserID: "player-1",
                    Name: "Ivan",
                    Class: "MPO",
                    Sum: 54,
                    Diff: -6,
                    Place: 1,
                  },
                ],
              },
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
    found: 1,
    created: 1,
    updated: 0,
    skipped: 1,
    errors: 1,
  });
  assert.equal(result.fetchedResults?.length, 1);
  assert.equal(result.mappedResults?.length, 1);
  assert.equal(result.issues.length, 1);
  assert.equal(result.issues[0]?.recordKey, "competition:competition-102");
  assert.equal(adapter.snapshot().length, 1);
});

test("runResultsUpdateJob updates an existing result on repeat runs instead of inserting duplicates", async () => {
  const adapter = new InMemoryCompetitionResultsAdapter([
    {
      id: 1,
      competition_id: "competition-101",
      player_id: "player-1",
      class_name: "MPO",
      sum: 54,
      diff: -6,
      order_number: 1,
      dnf: false,
      raw_payload: { UserID: "player-1", Place: 1 },
      source_fetched_at: "2026-03-22T10:00:00.000Z",
    },
  ]);
  const repository = createCompetitionResultsRepository(adapter);
  const result = await runResultsUpdateJob(
    {
      dateFrom: "2026-04-01",
      dateTo: "2026-04-30",
    },
    {
      baseUrl: "https://discgolfmetrix.com",
      countryCode: "RU",
      apiCode: "secret-code",
      resultsRepository: repository,
      readCompetitions: async () => ({
        competitions: [
          {
            competitionId: "competition-101",
            metrixId: "metrix-101",
            competitionDate: "2026-04-10",
          },
        ],
        skippedCount: 0,
        issues: [],
      }),
      fetchImpl: async () =>
        createMockResponse(
          JSON.stringify({
            Competition: {
              Results: [
                {
                  UserID: "player-1",
                  Name: "Ivan",
                  Class: "MPO",
                  Sum: 55,
                  Diff: -5,
                  Place: 1,
                },
              ],
            },
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
  assert.equal(adapter.snapshot().length, 1);
  assert.equal(adapter.snapshot()[0]?.sum, 55);
});
