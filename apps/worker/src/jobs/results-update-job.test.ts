import assert from "node:assert/strict";
import test from "node:test";

import {
  createCompetitionResultsRepository,
  type CompetitionResultRow,
  type CompetitionResultsPersistenceAdapter,
  type StoredCompetitionResultRecord,
} from "../persistence/competition-results-repository";
import {
  createCompetitionCommentsRepository,
  RESULTS_FETCH_BLOCKER_COMMENT,
  type CompetitionCommentRow,
  type CompetitionCommentsPersistenceAdapter,
} from "../persistence/competition-comments-repository";
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
  ): Promise<CompetitionResultRow | null> {
    return (
      this.rows.find(
        (row) =>
          row.competition_id === competitionId &&
          row.player_id === playerId
      ) ?? null
    );
  }

  async findByCompetitionIds(competitionIds: string[]): Promise<CompetitionResultRow[]> {
    return this.rows.filter((row) => competitionIds.includes(row.competition_id));
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

  async upsert(records: StoredCompetitionResultRecord[]): Promise<CompetitionResultRow[]> {
    return records.map((record) => {
      const existing = this.rows.find(
        (row) =>
          row.competition_id === record.competition_id &&
          row.player_id === record.player_id
      );

      if (existing) {
        const updated = { id: existing.id, ...record };
        const index = this.rows.findIndex((row) => row.id === existing.id);
        this.rows[index] = updated;
        return updated;
      }

      const created = { id: this.nextId++, ...record };
      this.rows.push(created);
      return created;
    });
  }

  snapshot() {
    return [...this.rows];
  }
}

class InMemoryCompetitionCommentsAdapter
  implements CompetitionCommentsPersistenceAdapter
{
  private rows: CompetitionCommentRow[];

  constructor(initialRows: CompetitionCommentRow[] = []) {
    this.rows = [...initialRows];
  }

  async findByCompetitionId(competitionId: string): Promise<CompetitionCommentRow | null> {
    return this.rows.find((row) => row.competition_id === competitionId) ?? null;
  }

  async findByCompetitionIds(competitionIds: string[]): Promise<CompetitionCommentRow[]> {
    return this.rows.filter((row) => competitionIds.includes(row.competition_id));
  }

  async updateComment(competitionId: string, comment: string | null): Promise<void> {
    const rowIndex = this.rows.findIndex((row) => row.competition_id === competitionId);

    if (rowIndex < 0) {
      return;
    }

    const currentRow = this.rows[rowIndex]!;
    this.rows[rowIndex] = {
      ...currentRow,
      comment,
    };
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

test("runResultsUpdateJob writes a fetch blocker comment for the affected competition", async () => {
  const repository = createCompetitionResultsRepository(
    new InMemoryCompetitionResultsAdapter(),
  );
  const commentsAdapter = new InMemoryCompetitionCommentsAdapter([
    {
      competition_id: "competition-102",
      parent_id: null,
      record_type: "4",
      players_count: 24,
      comment: null,
    },
  ]);
  const competitionCommentsRepository = createCompetitionCommentsRepository(
    commentsAdapter,
  );

  await runResultsUpdateJob(
    {
      dateFrom: "2026-04-01",
      dateTo: "2026-04-30",
    },
    {
      baseUrl: "https://discgolfmetrix.com",
      countryCode: "RU",
      apiCode: "secret-code",
      resultsRepository: repository,
      competitionCommentsRepository,
      readCompetitions: async () => ({
        competitions: [
          {
            competitionId: "competition-102",
            metrixId: null,
            competitionDate: "2026-04-11",
          },
        ],
        skippedCount: 0,
        issues: [],
      }),
      fetchImpl: async () => createMockResponse("upstream unavailable", { status: 503 }),
    },
  );

  assert.equal(commentsAdapter.snapshot()[0]?.comment, RESULTS_FETCH_BLOCKER_COMMENT);
});

test("runResultsUpdateJob bubbles a child fetch blocker comment to the visible parent competition", async () => {
  const repository = createCompetitionResultsRepository(
    new InMemoryCompetitionResultsAdapter(),
  );
  const commentsAdapter = new InMemoryCompetitionCommentsAdapter([
    {
      competition_id: "event-100",
      parent_id: null,
      record_type: "4",
      players_count: 24,
      comment: null,
    },
    {
      competition_id: "pool-100",
      parent_id: "event-100",
      record_type: "3",
      players_count: 6,
      comment: null,
    },
  ]);
  const competitionCommentsRepository = createCompetitionCommentsRepository(
    commentsAdapter,
  );

  await runResultsUpdateJob(
    {
      dateFrom: "2026-04-01",
      dateTo: "2026-04-30",
    },
    {
      baseUrl: "https://discgolfmetrix.com",
      countryCode: "RU",
      apiCode: "secret-code",
      resultsRepository: repository,
      competitionCommentsRepository,
      readCompetitions: async () => ({
        competitions: [
          {
            competitionId: "pool-100",
            metrixId: null,
            competitionDate: "2026-04-11",
          },
        ],
        skippedCount: 0,
        issues: [],
      }),
      fetchImpl: async () => createMockResponse("upstream unavailable", { status: 503 }),
    },
  );

  const parentCompetition = commentsAdapter.snapshot().find((row) => {
    return row.competition_id === "event-100";
  });

  assert.equal(parentCompetition?.comment, RESULTS_FETCH_BLOCKER_COMMENT);
  assert.equal(
    commentsAdapter.snapshot().find((row) => row.competition_id === "pool-100")?.comment,
    null,
  );
});

test("runResultsUpdateJob clears a worker-managed fetch blocker comment after successful rerun", async () => {
  const repository = createCompetitionResultsRepository(
    new InMemoryCompetitionResultsAdapter(),
  );
  const commentsAdapter = new InMemoryCompetitionCommentsAdapter([
    {
      competition_id: "competition-101",
      parent_id: null,
      record_type: "4",
      players_count: 24,
      comment: RESULTS_FETCH_BLOCKER_COMMENT,
    },
  ]);
  const competitionCommentsRepository = createCompetitionCommentsRepository(
    commentsAdapter,
  );

  await runResultsUpdateJob(
    {
      dateFrom: "2026-04-01",
      dateTo: "2026-04-30",
    },
    {
      baseUrl: "https://discgolfmetrix.com",
      countryCode: "RU",
      apiCode: "secret-code",
      resultsRepository: repository,
      competitionCommentsRepository,
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
                  Sum: 54,
                  Diff: -6,
                  Place: 1,
                },
              ],
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    },
  );

  assert.equal(commentsAdapter.snapshot()[0]?.comment, null);
});

test("runResultsUpdateJob skips an existing result when overwriteExisting is disabled", async () => {
  const adapter = new InMemoryCompetitionResultsAdapter([
    {
      id: 1,
      competition_id: "competition-101",
      player_id: "player-1",
      class_name: "MPO",
      sum: 54,
      diff: -6,
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

  assert.equal(result.finalStatus, "completed_with_issues");
  assert.deepEqual(result.summary, {
    found: 1,
    created: 0,
    updated: 0,
    skipped: 1,
    errors: 0,
  });
  assert.equal(adapter.snapshot().length, 1);
  assert.equal(adapter.snapshot()[0]?.sum, 54);
});

test("runResultsUpdateJob updates an existing result when overwriteExisting is enabled", async () => {
  const adapter = new InMemoryCompetitionResultsAdapter([
    {
      id: 1,
      competition_id: "competition-101",
      player_id: "player-1",
      class_name: "MPO",
      sum: 54,
      diff: -6,
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
      overwriteExisting: true,
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
  assert.equal(adapter.snapshot()[0]?.sum, 55);
});
