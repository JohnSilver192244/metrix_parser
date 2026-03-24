import assert from "node:assert/strict";
import test from "node:test";

import { runPlayersUpdateJob } from "./players-update-job";
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

test("runPlayersUpdateJob extracts valid players from fetched results without manual identifiers", async () => {
  const adapter = new InMemoryPlayersAdapter();
  const repository = createPlayersRepository(adapter);
  const resultsRepository = createCompetitionResultsRepository(
    new InMemoryCompetitionResultsAdapter(),
  );
  const result = await runPlayersUpdateJob(
    {
      dateFrom: "2026-04-01",
      dateTo: "2026-04-30",
    },
    {
      baseUrl: "https://discgolfmetrix.com",
      countryCode: "RU",
      apiCode: "secret-code",
      repository,
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
              results: [
                { playerId: "player-1", playerName: "Ivan" },
                { playerId: "player-2", playerName: "Petr" },
              ],
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }

        return createMockResponse(
          JSON.stringify({
            standings: [
              { playerId: "player-1", playerName: "Ivan S. Ivanov" },
              { playerId: "player-3", playerName: "Sergey" },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      },
    },
  );

  assert.equal(result.operation, "players");
  assert.equal(result.finalStatus, "completed_with_issues");
  assert.deepEqual(result.summary, {
    found: 3,
    created: 3,
    updated: 0,
    skipped: 4,
    errors: 5,
  });
  assert.equal(result.mappedPlayers?.length, 3);
  assert.equal(result.diagnostics?.players?.summary.created, 3);
  assert.equal(result.diagnostics?.results?.summary.found, 0);
  assert.equal(result.diagnostics?.results?.summary.skipped, 4);
  assert.deepEqual(
    result.mappedPlayers?.find((player) => player.playerId === "player-1"),
    {
      playerId: "player-1",
      playerName: "Ivan S. Ivanov",
    },
  );
  assert.equal(result.fetchedResults?.length, 2);
  assert.equal(adapter.snapshot().length, 3);
  assert.equal(result.issues.length, 5);
  assert.equal(result.issues[0]?.code, "player_name_conflict");
});

test("runPlayersUpdateJob keeps partial-failure semantics for broken player fragments and fetch issues", async () => {
  const adapter = new InMemoryPlayersAdapter();
  const repository = createPlayersRepository(adapter);
  const resultsRepository = createCompetitionResultsRepository(
    new InMemoryCompetitionResultsAdapter(),
  );
  const result = await runPlayersUpdateJob(
    {
      dateFrom: "2026-04-01",
      dateTo: "2026-04-30",
    },
    {
      baseUrl: "https://discgolfmetrix.com",
      countryCode: "RU",
      apiCode: "secret-code",
      repository,
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
              players: [
                { playerId: "player-1", playerName: "Ivan" },
                { playerId: "player-2" },
              ],
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
    skipped: 4,
    errors: 4,
  });
  assert.equal(result.diagnostics?.players?.summary.found, 1);
  assert.equal(result.diagnostics?.results?.summary.found, 0);
  assert.equal(result.issues.length, 4);
  assert.equal(result.issues[0]?.recordKey, "competition:competition-102");
  assert.equal(result.issues[1]?.recordKey, "player:player-2");
  assert.equal(result.mappedPlayers?.length, 1);
  assert.equal(adapter.snapshot().length, 1);
});

test("runPlayersUpdateJob reports completed_with_issues when fetch succeeds but no valid players are produced", async () => {
  const adapter = new InMemoryPlayersAdapter();
  const repository = createPlayersRepository(adapter);
  const resultsRepository = createCompetitionResultsRepository(
    new InMemoryCompetitionResultsAdapter(),
  );
  const result = await runPlayersUpdateJob(
    {
      dateFrom: "2026-04-01",
      dateTo: "2026-04-30",
    },
    {
      baseUrl: "https://discgolfmetrix.com",
      countryCode: "RU",
      apiCode: "secret-code",
      repository,
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
              players: [{ playerId: "player-1" }],
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
    found: 0,
    created: 0,
    updated: 0,
    skipped: 3,
    errors: 3,
  });
  assert.equal(adapter.snapshot().length, 0);
  assert.equal(result.diagnostics?.players?.summary.found, 0);
  assert.equal(result.diagnostics?.results?.summary.found, 0);
});

test("runPlayersUpdateJob updates existing players by player_id without creating duplicates", async () => {
  const adapter = new InMemoryPlayersAdapter([
    {
      id: 1,
      player_id: "player-1",
      player_name: "Ivan Ivanov",
      raw_payload: { playerId: "player-1", playerName: "Ivan Ivanov" },
      source_fetched_at: "2026-03-22T10:00:00.000Z",
    },
  ]);
  const repository = createPlayersRepository(adapter);
  const resultsRepository = createCompetitionResultsRepository(
    new InMemoryCompetitionResultsAdapter(),
  );

  const result = await runPlayersUpdateJob(
    {
      dateFrom: "2026-04-01",
      dateTo: "2026-04-30",
    },
    {
      baseUrl: "https://discgolfmetrix.com",
      countryCode: "RU",
      apiCode: "secret-code",
      repository,
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
            results: [{ playerId: "player-1", playerName: "Ivan S. Ivanov" }],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    },
  );

  assert.equal(result.finalStatus, "completed_with_issues");
  assert.deepEqual(result.summary, {
    found: 1,
    created: 0,
    updated: 1,
    skipped: 1,
    errors: 1,
  });
  assert.equal(adapter.snapshot().length, 1);
  assert.equal(adapter.snapshot()[0]?.player_name, "Ivan S. Ivanov");
  assert.equal(result.diagnostics?.players?.summary.updated, 1);
  assert.equal(result.diagnostics?.results?.summary.found, 0);
});
