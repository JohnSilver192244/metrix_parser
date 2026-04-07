import assert from "node:assert/strict";
import test from "node:test";

import type { Player } from "@metrix-parser/shared-types";

import {
  createPlayersRepository,
  type PlayerRow,
  type PlayersPersistenceAdapter,
  type StoredPlayerRecord,
} from "./players-repository";

function createPlayer(overrides: Partial<Player> = {}): Player {
  return {
    playerId: "player-1",
    playerName: "Ivan Ivanov",
    ...overrides,
  };
}

function createStoredRow(overrides: Partial<PlayerRow> = {}): PlayerRow {
  return {
    id: 1,
    player_id: "player-1",
    player_name: "Ivan Ivanov",
    division: "MPO",
    rdga: true,
    rdga_since: "2026-01-15",
    season_division: "MPO",
    raw_payload: { playerId: "player-1", playerName: "Ivan Ivanov" },
    source_fetched_at: "2026-03-22T12:00:00.000Z",
    ...overrides,
  };
}

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

test("repository creates a new player when no existing record matches", async () => {
  const adapter = new InMemoryPlayersAdapter();
  const repository = createPlayersRepository(adapter);

  const result = await repository.savePlayer({
    player: createPlayer(),
    rawPayload: { playerId: "player-1", playerName: "Ivan Ivanov" },
    sourceFetchedAt: "2026-03-22T12:00:00.000Z",
  });

  assert.equal(result.action, "created");
  assert.equal(result.matchedExisting, false);
  assert.equal(result.issue, undefined);
  assert.equal(adapter.snapshot().length, 1);
  assert.equal(adapter.snapshot()[0]?.player_id, "player-1");
});

test("repository skips an existing player when overwriteExisting is disabled", async () => {
  const adapter = new InMemoryPlayersAdapter([createStoredRow()]);
  const repository = createPlayersRepository(adapter);

  const result = await repository.savePlayer({
    player: createPlayer(),
    rawPayload: { playerId: "player-1", playerName: "Ivan Ivanov" },
    sourceFetchedAt: "2026-03-22T12:05:00.000Z",
  });

  assert.equal(result.action, "skipped");
  assert.equal(result.matchedExisting, true);
  assert.equal(result.issue, undefined);
  assert.equal(adapter.snapshot().length, 1);
  assert.equal(adapter.snapshot()[0]?.player_name, "Ivan Ivanov");
  assert.equal(adapter.snapshot()[0]?.division, "MPO");
  assert.equal(adapter.snapshot()[0]?.rdga, true);
  assert.equal(adapter.snapshot()[0]?.rdga_since, "2026-01-15");
  assert.equal(adapter.snapshot()[0]?.season_division, "MPO");
});

test("repository updates changed player_name in place when a match is found", async () => {
  const adapter = new InMemoryPlayersAdapter([createStoredRow()]);
  const repository = createPlayersRepository(adapter);

  const result = await repository.savePlayer(
    {
      player: createPlayer({ playerName: "Ivan S. Ivanov" }),
      rawPayload: { playerId: "player-1", playerName: "Ivan S. Ivanov" },
      sourceFetchedAt: "2026-03-22T12:10:00.000Z",
    },
    { overwriteExisting: true },
  );

  assert.equal(result.action, "updated");
  assert.equal(result.matchedExisting, true);
  assert.equal(adapter.snapshot()[0]?.player_name, "Ivan S. Ivanov");
  assert.equal(adapter.snapshot()[0]?.division, "MPO");
  assert.equal(adapter.snapshot()[0]?.rdga, true);
  assert.equal(adapter.snapshot()[0]?.rdga_since, "2026-01-15");
  assert.equal(adapter.snapshot()[0]?.season_division, "MPO");
});

test("repository does not overwrite user-managed fields when overwriteExisting is enabled", async () => {
  const adapter = new InMemoryPlayersAdapter([createStoredRow()]);
  const repository = createPlayersRepository(adapter);

  const result = await repository.savePlayer(
    {
      player: createPlayer({
        playerName: "Ivan S. Ivanov",
        division: "MA3",
        rdga: false,
        rdgaSince: "2026-02-01",
        seasonDivision: "MA3",
      }),
      rawPayload: { playerId: "player-1", playerName: "Ivan S. Ivanov" },
      sourceFetchedAt: "2026-03-22T12:10:00.000Z",
    },
    { overwriteExisting: true },
  );

  assert.equal(result.action, "updated");
  assert.equal(result.matchedExisting, true);
  assert.equal(adapter.snapshot()[0]?.player_name, "Ivan S. Ivanov");
  assert.equal(adapter.snapshot()[0]?.division, "MPO");
  assert.equal(adapter.snapshot()[0]?.rdga, true);
  assert.equal(adapter.snapshot()[0]?.rdga_since, "2026-01-15");
  assert.equal(adapter.snapshot()[0]?.season_division, "MPO");
});

test("repository skips problematic player records with missing player_id", async () => {
  const adapter = new InMemoryPlayersAdapter();
  const repository = createPlayersRepository(adapter);

  const result = await repository.savePlayer({
    player: createPlayer({ playerId: "" }),
    rawPayload: { playerName: "Ivan Ivanov" },
    sourceFetchedAt: "2026-03-22T12:15:00.000Z",
  });

  assert.equal(result.action, "skipped");
  assert.equal(result.matchedExisting, false);
  assert.equal(result.issue?.code, "player_missing_identity");
  assert.equal(result.issue?.stage, "validation");
  assert.equal(adapter.snapshot().length, 0);
});

test("repository skips problematic player records with missing player_name", async () => {
  const adapter = new InMemoryPlayersAdapter();
  const repository = createPlayersRepository(adapter);

  const result = await repository.savePlayer({
    player: createPlayer({ playerName: " " }),
    rawPayload: { playerId: "player-1" },
    sourceFetchedAt: "2026-03-22T12:20:00.000Z",
  });

  assert.equal(result.action, "skipped");
  assert.equal(result.matchedExisting, false);
  assert.equal(result.issue?.code, "player_missing_name");
  assert.equal(result.issue?.stage, "validation");
  assert.equal(adapter.snapshot().length, 0);
});

test("repository batch-skips existing players when overwriteExisting is disabled", async () => {
  const adapter = new InMemoryPlayersAdapter([
    createStoredRow({
      player_id: "player-1",
      player_name: "Ivan Ivanov",
      division: "MPO",
      rdga: true,
    }),
  ]);
  const repository = createPlayersRepository(adapter);

  const result = await repository.savePlayers([
    {
      player: createPlayer({ playerId: "player-1", playerName: "Ivan S. Ivanov" }),
      rawPayload: { playerId: "player-1", playerName: "Ivan S. Ivanov" },
      sourceFetchedAt: "2026-03-22T12:10:00.000Z",
    },
    {
      player: createPlayer({ playerId: "player-2", playerName: "Petr Petrov" }),
      rawPayload: { playerId: "player-2", playerName: "Petr Petrov" },
      sourceFetchedAt: "2026-03-22T12:15:00.000Z",
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
  assert.equal(adapter.snapshot()[0]?.player_name, "Ivan Ivanov");
  assert.equal(adapter.snapshot()[0]?.division, "MPO");
  assert.equal(adapter.snapshot()[0]?.rdga, true);
  assert.equal(adapter.snapshot()[0]?.rdga_since, "2026-01-15");
  assert.equal(adapter.snapshot()[0]?.season_division, "MPO");
});

test("repository batch-upserts players while preserving user-managed fields", async () => {
  const adapter = new InMemoryPlayersAdapter([
    createStoredRow({
      player_id: "player-1",
      player_name: "Ivan Ivanov",
      division: "MPO",
      rdga: true,
    }),
  ]);
  const repository = createPlayersRepository(adapter);

  const result = await repository.savePlayers(
    [
      {
        player: createPlayer({
          playerId: "player-1",
          playerName: "Ivan S. Ivanov",
          division: "MA3",
          rdga: false,
          rdgaSince: "2026-02-01",
          seasonDivision: "MA3",
        }),
        rawPayload: { playerId: "player-1", playerName: "Ivan S. Ivanov" },
        sourceFetchedAt: "2026-03-22T12:10:00.000Z",
      },
      {
        player: createPlayer({ playerId: "player-2", playerName: "Petr Petrov" }),
        rawPayload: { playerId: "player-2", playerName: "Petr Petrov" },
        sourceFetchedAt: "2026-03-22T12:15:00.000Z",
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
  assert.equal(adapter.snapshot()[0]?.player_name, "Ivan S. Ivanov");
  assert.equal(adapter.snapshot()[0]?.division, "MPO");
  assert.equal(adapter.snapshot()[0]?.rdga, true);
  assert.equal(adapter.snapshot()[0]?.rdga_since, "2026-01-15");
  assert.equal(adapter.snapshot()[0]?.season_division, "MPO");
});
