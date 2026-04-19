import assert from "node:assert/strict";
import test from "node:test";

import type { Competition } from "@metrix-parser/shared-types";

import {
  createCompetitionsRepository,
  type CompetitionRow,
  type CompetitionsPersistenceAdapter,
  type StoredCompetitionRecord,
} from "./competitions-repository";

function createCompetition(overrides: Partial<Competition> = {}): Competition {
  return {
    competitionId: "101",
    competitionName: "Moscow Open",
    competitionDate: "2026-04-12",
    parentId: "9001",
    courseId: "course-101",
    courseName: "Tiraz Park",
    recordType: "tournament",
    playersCount: 72,
    metrixId: "metrix-101",
    ...overrides,
  };
}

function createStoredRow(overrides: Partial<CompetitionRow> = {}): CompetitionRow {
  return {
    id: 1,
    competition_id: "101",
    competition_name: "Moscow Open",
    competition_date: "2026-04-12",
    parent_id: "9001",
    course_id: "course-101",
    course_name: "Tiraz Park",
    record_type: "tournament",
    players_count: 72,
    metrix_id: "metrix-101",
    ...overrides,
  };
}

class InMemoryCompetitionsAdapter implements CompetitionsPersistenceAdapter {
  private rows: CompetitionRow[];
  private nextId: number;

  constructor(initialRows: CompetitionRow[] = []) {
    this.rows = [...initialRows];
    this.nextId = initialRows.reduce((maxId, row) => Math.max(maxId, row.id), 0) + 1;
  }

  async findByCompetitionId(competitionId: string): Promise<CompetitionRow | null> {
    return this.rows.find((row) => row.competition_id === competitionId) ?? null;
  }

  async findByMetrixId(metrixId: string): Promise<CompetitionRow | null> {
    return this.rows.find((row) => row.metrix_id === metrixId) ?? null;
  }

  async findByCompetitionIds(competitionIds: string[]): Promise<CompetitionRow[]> {
    return this.rows.filter((row) => competitionIds.includes(row.competition_id));
  }

  async findByMetrixIds(metrixIds: string[]): Promise<CompetitionRow[]> {
    return this.rows.filter((row) => row.metrix_id !== null && metrixIds.includes(row.metrix_id));
  }

  async insert(record: StoredCompetitionRecord): Promise<CompetitionRow> {
    const created = { id: this.nextId++, ...record };
    this.rows.push(created);
    return created;
  }

  async update(id: number, record: StoredCompetitionRecord): Promise<CompetitionRow> {
    const index = this.rows.findIndex((row) => row.id === id);

    if (index < 0) {
      throw new Error(`Competition row ${id} not found`);
    }

    const updated = { id, ...record };
    this.rows[index] = updated;
    return updated;
  }

  async upsert(records: StoredCompetitionRecord[]): Promise<CompetitionRow[]> {
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

  snapshot() {
    return [...this.rows];
  }
}

test("repository creates a new competition when no existing record matches", async () => {
  const adapter = new InMemoryCompetitionsAdapter();
  const repository = createCompetitionsRepository(adapter);

  const result = await repository.saveCompetition({
    competition: createCompetition(),
    rawPayload: { competitionId: "101", courseId: "course-101" },
    sourceFetchedAt: "2026-03-21T12:00:00.000Z",
  });

  assert.equal(result.action, "created");
  assert.equal(result.matchedExisting, false);
  assert.equal(result.issue, undefined);
  assert.equal(adapter.snapshot().length, 1);
  assert.equal(adapter.snapshot()[0]?.competition_id, "101");
});

test("repository does not persist read-model-only competition fields", async () => {
  const adapter = new InMemoryCompetitionsAdapter();
  const repository = createCompetitionsRepository(adapter);

  await repository.saveCompetition({
    competition: createCompetition({
      hasResults: true,
      seasonPoints: 123.45,
    }),
    rawPayload: { competitionId: "101" },
    sourceFetchedAt: "2026-03-21T12:00:00.000Z",
  });

  const storedRow = adapter.snapshot()[0] ?? {};
  assert.equal(
    Object.prototype.hasOwnProperty.call(storedRow, "has_results"),
    false,
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(storedRow, "season_points"),
    false,
  );
});

test("repository skips an existing competition when overwriteExisting is disabled", async () => {
  const adapter = new InMemoryCompetitionsAdapter([createStoredRow()]);
  const repository = createCompetitionsRepository(adapter);

  const result = await repository.saveCompetition({
    competition: createCompetition(),
    rawPayload: { competitionId: "101", courseId: "course-101" },
    sourceFetchedAt: "2026-03-21T12:00:00.000Z",
  });

  assert.equal(result.action, "skipped");
  assert.equal(result.matchedExisting, true);
  assert.equal(result.issue, undefined);
  assert.equal(
    result.skipReason?.code,
    "competition_existing_record_skipped",
  );
  assert.equal(adapter.snapshot().length, 1);
  assert.equal(adapter.snapshot()[0]?.competition_name, "Moscow Open");
  assert.equal(adapter.snapshot()[0]?.parent_id, "9001");
});

test("repository updates changed competition fields in place when a match is found", async () => {
  const adapter = new InMemoryCompetitionsAdapter([createStoredRow()]);
  const repository = createCompetitionsRepository(adapter);

  const result = await repository.saveCompetition(
    {
      competition: createCompetition({
        competitionName: "Moscow Open 2026",
        playersCount: 80,
      }),
      rawPayload: { competitionId: "101", courseId: "course-101" },
      sourceFetchedAt: "2026-03-21T12:00:00.000Z",
    },
    { overwriteExisting: true },
  );

  assert.equal(result.action, "updated");
  assert.equal(result.matchedExisting, true);
  assert.equal(result.issue, undefined);
  assert.equal(adapter.snapshot().length, 1);
  assert.equal(adapter.snapshot()[0]?.competition_name, "Moscow Open 2026");
  assert.equal(adapter.snapshot()[0]?.players_count, 80);
});

test("repository persists changed parent_id in place when a match is found", async () => {
  const adapter = new InMemoryCompetitionsAdapter([createStoredRow()]);
  const repository = createCompetitionsRepository(adapter);

  const result = await repository.saveCompetition(
    {
      competition: createCompetition({
        parentId: "9002",
      }),
      rawPayload: { competitionId: "101", ParentID: "9002" },
      sourceFetchedAt: "2026-03-21T12:00:00.000Z",
    },
    { overwriteExisting: true },
  );

  assert.equal(result.action, "updated");
  assert.equal(result.matchedExisting, true);
  assert.equal(result.issue, undefined);
  assert.equal(adapter.snapshot()[0]?.parent_id, "9002");
});

test("repository preserves an existing metrix_id when the new payload omits it", async () => {
  const adapter = new InMemoryCompetitionsAdapter([
    createStoredRow({ id: 1, competition_id: "101", metrix_id: "metrix-101" }),
  ]);
  const repository = createCompetitionsRepository(adapter);

  const result = await repository.saveCompetition(
    {
      competition: createCompetition({
        competitionId: "101",
        metrixId: null,
        competitionName: "Moscow Open Renamed",
      }),
      rawPayload: { competitionId: "101" },
      sourceFetchedAt: "2026-03-21T12:00:00.000Z",
    },
    { overwriteExisting: true },
  );

  assert.equal(result.action, "updated");
  assert.equal(result.matchedExisting, true);
  assert.equal(result.issue, undefined);
  assert.equal(adapter.snapshot().length, 1);
  assert.equal(adapter.snapshot()[0]?.competition_name, "Moscow Open Renamed");
  assert.equal(adapter.snapshot()[0]?.metrix_id, "metrix-101");
});

test("repository does not overwrite category_id when overwriteExisting is enabled", async () => {
  const adapter = new InMemoryCompetitionsAdapter([
    createStoredRow({
      id: 1,
      competition_id: "101",
      category_id: "league",
      metrix_id: "metrix-101",
    }),
  ]);
  const repository = createCompetitionsRepository(adapter);

  const result = await repository.saveCompetition(
    {
      competition: createCompetition({
        competitionId: "101",
        categoryId: "major",
        competitionName: "Moscow Open Renamed",
      }),
      rawPayload: { competitionId: "101", categoryId: "major" },
      sourceFetchedAt: "2026-03-21T12:00:00.000Z",
    },
    { overwriteExisting: true },
  );

  assert.equal(result.action, "updated");
  assert.equal(result.matchedExisting, true);
  assert.equal(result.issue, undefined);
  assert.equal(adapter.snapshot().length, 1);
  assert.equal(adapter.snapshot()[0]?.competition_name, "Moscow Open Renamed");
  assert.equal(adapter.snapshot()[0]?.category_id, "league");
});

test("repository skips a conflicting record when competition_id and metrix_id point to different rows", async () => {
  const adapter = new InMemoryCompetitionsAdapter([
    createStoredRow({ id: 1, competition_id: "101", metrix_id: "metrix-101" }),
    createStoredRow({ id: 2, competition_id: "202", metrix_id: "metrix-202" }),
  ]);
  const repository = createCompetitionsRepository(adapter);

  const result = await repository.saveCompetition(
    {
      competition: createCompetition({
        competitionId: "101",
        metrixId: "metrix-202",
      }),
      rawPayload: { competitionId: "101", courseId: "course-101" },
      sourceFetchedAt: "2026-03-21T12:00:00.000Z",
    },
  );

  assert.equal(result.action, "skipped");
  assert.equal(result.matchedExisting, false);
  assert.equal(result.issue?.code, "competition_identity_conflict");
  assert.equal(result.issue?.stage, "matching");
  assert.equal(adapter.snapshot().length, 2);
});

test("repository skips problematic competition records with missing stable identifiers", async () => {
  const adapter = new InMemoryCompetitionsAdapter();
  const repository = createCompetitionsRepository(adapter);

  const result = await repository.saveCompetition(
    {
      competition: createCompetition({
        competitionId: "",
        metrixId: null,
      }),
      rawPayload: { courseId: "course-101" },
      sourceFetchedAt: "2026-03-21T12:00:00.000Z",
    },
  );

  assert.equal(result.action, "skipped");
  assert.equal(result.matchedExisting, false);
  assert.equal(result.issue?.code, "competition_missing_identity");
  assert.equal(result.issue?.stage, "validation");
  assert.equal(adapter.snapshot().length, 0);
});

test("repository saves competitions in batch while preserving skip reasons and updates", async () => {
  const adapter = new InMemoryCompetitionsAdapter([createStoredRow()]);
  const repository = createCompetitionsRepository(adapter);

  const result = await repository.saveCompetitions(
    [
      {
        competition: createCompetition({
          competitionId: "101",
          competitionName: "Moscow Open Renamed",
        }),
        rawPayload: { competitionId: "101" },
        sourceFetchedAt: "2026-03-21T12:00:00.000Z",
      },
      {
        competition: createCompetition({
          competitionId: "202",
          metrixId: "metrix-202",
          competitionName: "Winter Cup",
        }),
        rawPayload: { competitionId: "202" },
        sourceFetchedAt: "2026-03-21T12:05:00.000Z",
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
  assert.equal(result.issues.length, 0);
  assert.equal(result.skipReasons.length, 0);
  assert.equal(adapter.snapshot().length, 2);
  assert.equal(adapter.snapshot()[0]?.competition_name, "Moscow Open Renamed");
});

test("repository preloads existing rows for batch matching", async () => {
  const adapter = new InMemoryCompetitionsAdapter([
    createStoredRow({ id: 1, competition_id: "101", metrix_id: "metrix-101" }),
    createStoredRow({ id: 2, competition_id: "102", metrix_id: "metrix-102" }),
  ]);
  const repository = createCompetitionsRepository(adapter);

  const existingIndex = await repository.preloadExisting([
    {
      competition: createCompetition({ competitionId: "101", metrixId: "metrix-101" }),
      rawPayload: { competitionId: "101" },
      sourceFetchedAt: "2026-03-21T12:00:00.000Z",
    },
    {
      competition: createCompetition({ competitionId: "999", metrixId: "metrix-102" }),
      rawPayload: { competitionId: "999" },
      sourceFetchedAt: "2026-03-21T12:00:00.000Z",
    },
  ]);

  assert.equal(existingIndex.byCompetitionId.get("101")?.id, 1);
  assert.equal(existingIndex.byMetrixId.get("metrix-102")?.id, 2);
});

test("repository skips unchanged competition rows when overwriteExisting is enabled", async () => {
  const adapter = new InMemoryCompetitionsAdapter([
    {
      ...createStoredRow({
        id: 1,
        competition_id: "101",
        metrix_id: "metrix-101",
      }),
      raw_payload: { competitionId: "101", courseId: "course-101" },
      source_fetched_at: "2026-03-21T12:00:00.000Z",
    },
  ]);
  const repository = createCompetitionsRepository(adapter);
  const existingIndex = await repository.preloadExisting([
    {
      competition: createCompetition(),
      rawPayload: { competitionId: "101", courseId: "course-101" },
      sourceFetchedAt: "2026-03-21T12:00:00.000Z",
    },
  ]);

  const result = await repository.saveCompetition(
    {
      competition: createCompetition(),
      rawPayload: { competitionId: "101", courseId: "course-101" },
      sourceFetchedAt: "2026-03-21T12:00:00.000Z",
    },
    {
      overwriteExisting: true,
      existingIndex,
    },
  );

  assert.equal(result.action, "skipped");
  assert.equal(result.matchedExisting, true);
  assert.equal(result.skipReason?.code, "competition_unchanged_skipped");
  assert.equal(adapter.snapshot().length, 1);
});
