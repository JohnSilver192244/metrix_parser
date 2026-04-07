import assert from "node:assert/strict";
import test from "node:test";

import type { CompetitionResult } from "@metrix-parser/shared-types";

import {
  createCompetitionResultsRepository,
  type CompetitionResultRow,
  type CompetitionResultsPersistenceAdapter,
  type StoredCompetitionResultRecord,
} from "./competition-results-repository";

function createCompetitionResult(
  overrides: Partial<CompetitionResult> = {},
): CompetitionResult {
  return {
    competitionId: "competition-101",
    playerId: "player-1",
    className: "MPO",
    sum: 54,
    diff: -6,
    orderNumber: 1,
    dnf: false,
    ...overrides,
  };
}

function createStoredRow(
  overrides: Partial<CompetitionResultRow> = {},
): CompetitionResultRow {
  return {
    id: 1,
    competition_id: "competition-101",
    player_id: "player-1",
    class_name: "MPO",
    sum: 54,
    diff: -6,
    order_number: 1,
    dnf: false,
    raw_payload: { UserID: "player-1" },
    source_fetched_at: "2026-03-22T10:00:00.000Z",
    ...overrides,
  };
}

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

    if (index < 0) {
      throw new Error(`Competition result row ${id} not found`);
    }

    const updated = { id, ...record };
    this.rows[index] = updated;
    return updated;
  }

  async upsert(records: StoredCompetitionResultRecord[]): Promise<CompetitionResultRow[]> {
    return records.map((record) => {
      const existing = this.rows.find(
        (row) =>
          row.competition_id === record.competition_id &&
          row.player_id === record.player_id &&
          row.order_number === record.order_number,
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

test("repository creates a new competition result when no existing record matches the composite key", async () => {
  const adapter = new InMemoryCompetitionResultsAdapter();
  const repository = createCompetitionResultsRepository(adapter);

  const result = await repository.saveCompetitionResult({
    result: createCompetitionResult(),
    rawPayload: { UserID: "player-1", Place: 1 },
    sourceFetchedAt: "2026-03-22T10:00:00.000Z",
  });

  assert.equal(result.action, "created");
  assert.equal(result.matchedExisting, false);
  assert.equal(result.issue, undefined);
  assert.equal(adapter.snapshot().length, 1);
});

test("repository skips an existing competition result when overwriteExisting is disabled", async () => {
  const adapter = new InMemoryCompetitionResultsAdapter([createStoredRow()]);
  const repository = createCompetitionResultsRepository(adapter);

  const result = await repository.saveCompetitionResult({
    result: createCompetitionResult({
      sum: 55,
      diff: -5,
    }),
    rawPayload: { UserID: "player-1", Place: 1 },
    sourceFetchedAt: "2026-03-22T11:00:00.000Z",
  });

  assert.equal(result.action, "skipped");
  assert.equal(result.matchedExisting, true);
  assert.equal(result.issue, undefined);
  assert.equal(adapter.snapshot().length, 1);
  assert.equal(adapter.snapshot()[0]?.sum, 54);
});

test("repository allows DNF results to persist without numeric score fields", async () => {
  const adapter = new InMemoryCompetitionResultsAdapter();
  const repository = createCompetitionResultsRepository(adapter);

  const result = await repository.saveCompetitionResult({
    result: createCompetitionResult({
      playerId: "player-2",
      className: "MA3",
      sum: null,
      diff: null,
      orderNumber: 17,
      dnf: true,
    }),
    rawPayload: { UserID: "player-2", Place: 17, DNF: true },
    sourceFetchedAt: "2026-03-22T12:00:00.000Z",
  });

  assert.equal(result.action, "created");
  assert.equal(result.issue, undefined);
});

test("repository allows results without class name", async () => {
  const adapter = new InMemoryCompetitionResultsAdapter();
  const repository = createCompetitionResultsRepository(adapter);

  const result = await repository.saveCompetitionResult({
    result: createCompetitionResult({
      playerId: "player-2",
      className: null,
      sum: 53,
      diff: -7,
      orderNumber: 2,
    }),
    rawPayload: { UserID: "player-2", Place: 2 },
    sourceFetchedAt: "2026-03-22T12:00:00.000Z",
  });

  assert.equal(result.action, "created");
  assert.equal(result.issue, undefined);
});

test("repository does not persist derived season points into competition_results rows", async () => {
  const adapter = new InMemoryCompetitionResultsAdapter();
  const repository = createCompetitionResultsRepository(adapter);

  const result = await repository.saveCompetitionResult({
    result: createCompetitionResult({
      playerId: "player-3",
      orderNumber: 3,
      seasonPoints: 120,
    }),
    rawPayload: { UserID: "player-3", Place: 3 },
    sourceFetchedAt: "2026-03-22T12:10:00.000Z",
  });

  assert.equal(result.action, "created");
  assert.equal(
    Object.prototype.hasOwnProperty.call(adapter.snapshot()[0] ?? {}, "season_points"),
    false,
  );
});

test("repository skips incomplete non-DNF results before persistence", async () => {
  const adapter = new InMemoryCompetitionResultsAdapter();
  const repository = createCompetitionResultsRepository(adapter);

  const result = await repository.saveCompetitionResult({
    result: createCompetitionResult({
      sum: null,
      diff: null,
      dnf: false,
    }),
    rawPayload: { UserID: "player-1", Place: 1 },
    sourceFetchedAt: "2026-03-22T12:00:00.000Z",
  });

  assert.equal(result.action, "skipped");
  assert.equal(result.matchedExisting, false);
  assert.equal(result.issue?.code, "competition_result_missing_score");
  assert.equal(result.issue?.stage, "validation");
});

test("repository batch-skips existing competition results when overwriteExisting is disabled", async () => {
  const adapter = new InMemoryCompetitionResultsAdapter([createStoredRow()]);
  const repository = createCompetitionResultsRepository(adapter);

  const result = await repository.saveCompetitionResults([
    {
      result: createCompetitionResult({
        playerId: "player-1",
        sum: 55,
        diff: -5,
      }),
      rawPayload: { UserID: "player-1", Place: 1 },
      sourceFetchedAt: "2026-03-22T11:00:00.000Z",
    },
    {
      result: createCompetitionResult({
        playerId: "player-2",
        orderNumber: 2,
        sum: 58,
        diff: -2,
      }),
      rawPayload: { UserID: "player-2", Place: 2 },
      sourceFetchedAt: "2026-03-22T11:05:00.000Z",
    },
  ]);

  assert.deepEqual(result.summary, {
    found: 2,
    created: 1,
    updated: 0,
    skipped: 1,
    errors: 0,
  });
  assert.equal(adapter.snapshot().length, 2);
  assert.equal(adapter.snapshot()[0]?.sum, 54);
});

test("repository batch-upserts competition results", async () => {
  const adapter = new InMemoryCompetitionResultsAdapter([createStoredRow()]);
  const repository = createCompetitionResultsRepository(adapter);

  const result = await repository.saveCompetitionResults(
    [
      {
        result: createCompetitionResult({
          playerId: "player-1",
          sum: 55,
          diff: -5,
        }),
        rawPayload: { UserID: "player-1", Place: 1 },
        sourceFetchedAt: "2026-03-22T11:00:00.000Z",
      },
      {
        result: createCompetitionResult({
          playerId: "player-2",
          orderNumber: 2,
          sum: 58,
          diff: -2,
        }),
        rawPayload: { UserID: "player-2", Place: 2 },
        sourceFetchedAt: "2026-03-22T11:05:00.000Z",
      },
    ],
    { overwriteExisting: true },
  );

  assert.deepEqual(result.summary, {
    found: 2,
    created: 1,
    updated: 1,
    skipped: 0,
    errors: 0,
  });
  assert.equal(adapter.snapshot().length, 2);
  assert.equal(adapter.snapshot()[0]?.sum, 55);
});
