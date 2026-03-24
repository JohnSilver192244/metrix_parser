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

test("repository treats repeat-run of the same competition as update without creating duplicates", async () => {
  const adapter = new InMemoryCompetitionsAdapter([createStoredRow()]);
  const repository = createCompetitionsRepository(adapter);

  const result = await repository.saveCompetition({
    competition: createCompetition(),
    rawPayload: { competitionId: "101", courseId: "course-101" },
    sourceFetchedAt: "2026-03-21T12:00:00.000Z",
  });

  assert.equal(result.action, "updated");
  assert.equal(result.matchedExisting, true);
  assert.equal(result.issue, undefined);
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

  const result = await repository.saveCompetition({
    competition: createCompetition({
      parentId: "9002",
    }),
    rawPayload: { competitionId: "101", ParentID: "9002" },
    sourceFetchedAt: "2026-03-21T12:00:00.000Z",
  });

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

  const result = await repository.saveCompetition({
    competition: createCompetition({
      competitionId: "101",
      metrixId: null,
      competitionName: "Moscow Open Renamed",
    }),
    rawPayload: { competitionId: "101" },
    sourceFetchedAt: "2026-03-21T12:00:00.000Z",
  });

  assert.equal(result.action, "updated");
  assert.equal(result.matchedExisting, true);
  assert.equal(result.issue, undefined);
  assert.equal(adapter.snapshot().length, 1);
  assert.equal(adapter.snapshot()[0]?.competition_name, "Moscow Open Renamed");
  assert.equal(adapter.snapshot()[0]?.metrix_id, "metrix-101");
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
