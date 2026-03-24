import assert from "node:assert/strict";
import test from "node:test";

import {
  createCompetitionResultsRepository,
  type CompetitionResultRow,
  type CompetitionResultsPersistenceAdapter,
  type StoredCompetitionResultRecord,
} from "../persistence/competition-results-repository";
import {
  createPlayersRepository,
  type PlayerRow,
  type PlayersPersistenceAdapter,
  type StoredPlayerRecord,
} from "../persistence/players-repository";
import { createMockResponse } from "../test-support/mock-response";
import { runResultsPipelineUpdateJob } from "./results-pipeline-update-job";

class InMemoryPlayersAdapter implements PlayersPersistenceAdapter {
  private rows: PlayerRow[];
  private nextId: number;

  constructor(initialRows: PlayerRow[] = []) {
    this.rows = [...initialRows];
    this.nextId = initialRows.reduce((maxId, row) => Math.max(maxId, row.id), 0) + 1;
  }

  async findByPlayerId(playerId: string): Promise<PlayerRow | null> {
    return this.rows.find((row) => row.player_id === playerId) ?? null;
  }

  async findByPlayerIds(playerIds: string[]): Promise<PlayerRow[]> {
    return this.rows.filter((row) => playerIds.includes(row.player_id));
  }

  async insert(record: StoredPlayerRecord): Promise<PlayerRow> {
    const created = { id: this.nextId++, ...record };
    this.rows.push(created);
    return created;
  }

  async update(id: number, record: StoredPlayerRecord): Promise<PlayerRow> {
    const index = this.rows.findIndex((row) => row.id === id);

    if (index < 0) {
      throw new Error(`Player row ${id} not found`);
    }

    const updated = { id, ...record };
    this.rows[index] = updated;
    return updated;
  }

  async upsert(records: StoredPlayerRecord[]): Promise<PlayerRow[]> {
    return records.map((record) => {
      const existing = this.rows.find((row) => row.player_id === record.player_id);

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

test("runResultsPipelineUpdateJob persists valid players and results while aggregating transport and validation issues", async () => {
  const playersRepository = createPlayersRepository(new InMemoryPlayersAdapter());
  const resultsAdapter = new InMemoryCompetitionResultsAdapter();
  const resultsRepository = createCompetitionResultsRepository(resultsAdapter);

  const result = await runResultsPipelineUpdateJob(
    {
      dateFrom: "2026-04-01",
      dateTo: "2026-04-30",
    },
    {
      baseUrl: "https://discgolfmetrix.com",
      countryCode: "RU",
      apiCode: "secret-code",
      playersRepository,
      resultsRepository,
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
                  {
                    UserID: "player-2",
                    Name: "Petr",
                    Class: "MA3",
                    DNF: true,
                    Place: 22,
                  },
                  {
                    UserID: "player-3",
                    Class: "MA4",
                    Sum: 71,
                    Diff: 11,
                    Place: 35,
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
    found: 5,
    created: 5,
    updated: 0,
    skipped: 2,
    errors: 2,
  });
  assert.equal(result.diagnostics?.transport?.summary.skipped, 1);
  assert.equal(result.diagnostics?.players?.summary.created, 2);
  assert.equal(result.diagnostics?.players?.summary.skipped, 1);
  assert.equal(result.diagnostics?.results?.summary.created, 3);
  assert.equal(result.diagnostics?.results?.summary.skipped, 0);
  assert.equal(result.issues.length, 2);
  assert.equal(result.issues[0]?.recordKey, "competition:competition-102");
  assert.equal(result.issues[1]?.recordKey, "player:player-3");
  assert.equal(result.mappedPlayers?.length, 2);
  assert.equal(result.mappedResults?.length, 3);
  assert.equal(resultsAdapter.snapshot().length, 3);
  assert.equal(result.selectedCompetitionsCount, 2);
});

test("runResultsPipelineUpdateJob skips players without ids and still persists other players and results", async () => {
  const playersAdapter = new InMemoryPlayersAdapter();
  const resultsAdapter = new InMemoryCompetitionResultsAdapter();
  const playersRepository = createPlayersRepository(playersAdapter);
  const resultsRepository = createCompetitionResultsRepository(resultsAdapter);

  const result = await runResultsPipelineUpdateJob(
    {
      dateFrom: "2026-04-01",
      dateTo: "2026-04-30",
    },
    {
      baseUrl: "https://discgolfmetrix.com",
      countryCode: "RU",
      apiCode: "secret-code",
      playersRepository,
      resultsRepository,
      readCompetitions: async () => ({
        competitions: [
          {
            competitionId: "3530672",
            metrixId: null,
            competitionDate: "2026-04-12",
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
                  Name: "No Id Player",
                  Class: "MPO",
                  Sum: 54,
                  Diff: -6,
                  Place: 1,
                },
                {
                  UserID: "player-2",
                  Name: "Petr",
                  Class: "MA3",
                  Sum: 57,
                  Diff: -3,
                  Place: 2,
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
    found: 2,
    created: 2,
    updated: 0,
    skipped: 2,
    errors: 0,
  });
  assert.equal(result.issues.length, 0);
  assert.equal(result.mappedPlayers?.length, 1);
  assert.equal(result.mappedPlayers?.[0]?.playerId, "player-2");
  assert.equal(result.mappedResults?.length, 1);
  assert.equal(result.mappedResults?.[0]?.playerId, "player-2");
  assert.equal(result.diagnostics?.players?.summary.skipped, 1);
  assert.equal(result.diagnostics?.players?.summary.errors, 0);
  assert.equal(result.diagnostics?.results?.summary.skipped, 1);
  assert.equal(result.diagnostics?.results?.summary.errors, 0);
  assert.equal(playersAdapter.snapshot().length, 1);
  assert.equal(resultsAdapter.snapshot().length, 1);
});

test("runResultsPipelineUpdateJob keeps repeat runs idempotent for both players and results", async () => {
  const playersAdapter = new InMemoryPlayersAdapter([
    {
      id: 1,
      player_id: "player-1",
      player_name: "Ivan Ivanov",
      raw_payload: { playerId: "player-1", playerName: "Ivan Ivanov" },
      source_fetched_at: "2026-03-22T10:00:00.000Z",
    },
  ]);
  const resultsAdapter = new InMemoryCompetitionResultsAdapter([
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
  const playersRepository = createPlayersRepository(playersAdapter);
  const resultsRepository = createCompetitionResultsRepository(resultsAdapter);

  const result = await runResultsPipelineUpdateJob(
    {
      dateFrom: "2026-04-01",
      dateTo: "2026-04-30",
    },
    {
      baseUrl: "https://discgolfmetrix.com",
      countryCode: "RU",
      apiCode: "secret-code",
      playersRepository,
      resultsRepository,
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
                  Name: "Ivan S. Ivanov",
                  Class: "MPO",
                  Sum: 55,
                  Diff: -5,
                  Place: 1,
                },
                {
                  UserID: "player-2",
                  Name: "Petr",
                  Class: "MA3",
                  DNF: true,
                  Place: 22,
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
    found: 4,
    created: 2,
    updated: 2,
    skipped: 0,
    errors: 0,
  });
  assert.equal(playersAdapter.snapshot().length, 2);
  assert.equal(playersAdapter.snapshot()[0]?.player_name, "Ivan S. Ivanov");
  assert.equal(resultsAdapter.snapshot().length, 2);
  assert.equal(resultsAdapter.snapshot()[0]?.sum, 55);
  assert.equal(result.diagnostics?.players?.summary.updated, 1);
  assert.equal(result.diagnostics?.results?.summary.updated, 1);
});

test("runResultsPipelineUpdateJob returns failed when every upstream results fetch fails", async () => {
  const playersRepository = createPlayersRepository(new InMemoryPlayersAdapter());
  const resultsRepository = createCompetitionResultsRepository(
    new InMemoryCompetitionResultsAdapter(),
  );

  const result = await runResultsPipelineUpdateJob(
    {
      dateFrom: "2026-04-01",
      dateTo: "2026-04-30",
    },
    {
      baseUrl: "https://discgolfmetrix.com",
      countryCode: "RU",
      apiCode: "secret-code",
      playersRepository,
      resultsRepository,
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
      fetchImpl: async () => createMockResponse("upstream unavailable", { status: 503 }),
    },
  );

  assert.equal(result.finalStatus, "failed");
  assert.deepEqual(result.summary, {
    found: 0,
    created: 0,
    updated: 0,
    skipped: 2,
    errors: 2,
  });
  assert.equal(result.diagnostics?.transport?.summary.skipped, 2);
  assert.equal(result.diagnostics?.players?.summary.found, 0);
  assert.equal(result.diagnostics?.results?.summary.found, 0);
});
