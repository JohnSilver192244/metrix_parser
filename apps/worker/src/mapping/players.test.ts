import assert from "node:assert/strict";
import test from "node:test";

import { toPlayerDbRecord } from "@metrix-parser/shared-types";

import {
  incompletePlayerResultsFixture,
  multiPlayerResultsFixture,
  repeatedPlayerResultsFixture,
} from "./__fixtures__/players";
import {
  mapDiscGolfMetrixPlayerRecord,
  mapDiscGolfMetrixPlayersFromResults,
} from "./players";

test("mapDiscGolfMetrixPlayersFromResults extracts multiple players and keeps a reusable player model", () => {
  const result = mapDiscGolfMetrixPlayersFromResults([multiPlayerResultsFixture]);

  assert.equal(result.skippedCount, 0);
  assert.equal(result.issues.length, 0);
  assert.equal(result.players.length, 2);
  assert.equal(result.players[0]?.playerId, "player-1");
  assert.equal(result.players[0]?.playerName, "Ivan Ivanov");
  assert.equal(result.players[1]?.playerId, "player-2");
  assert.equal(result.players[1]?.playerName, "Petr Petrov");
  assert.deepEqual(toPlayerDbRecord(result.players[0]!), {
    player_id: "player-1",
    player_name: "Ivan Ivanov",
    division: undefined,
    competitions_count: undefined,
    rdga: undefined,
    rdga_since: undefined,
    season_division: undefined,
    season_points: undefined,
  });
  assert.equal(result.extractedPlayers.length, 2);
  assert.equal(result.extractedPlayers[0]?.competitionId, "competition-101");
});

test("mapDiscGolfMetrixPlayersFromResults deduplicates repeated players across result payloads", () => {
  const result = mapDiscGolfMetrixPlayersFromResults([
    multiPlayerResultsFixture,
    repeatedPlayerResultsFixture,
  ]);

  assert.equal(result.skippedCount, 0);
  assert.equal(result.issues.length, 1);
  assert.equal(result.issues[0]?.code, "player_name_conflict");
  assert.equal(result.issues[0]?.recordKey, "player:player-1");
  assert.equal(result.players.length, 3);
  assert.equal(
    result.players.find((player) => player.playerId === "player-1")?.playerName,
    "Ivan S. Ivanov",
  );
  assert.equal(result.extractedPlayers.length, 4);
});

test("mapDiscGolfMetrixPlayerRecord rejects incomplete player fragments", () => {
  const competitionSection = incompletePlayerResultsFixture.rawPayload
    .Competition as { Results?: unknown[] } | undefined;
  const playerEntries = competitionSection?.Results;

  assert.ok(Array.isArray(playerEntries));

  const sourceRecord = playerEntries[0] as Record<string, unknown> | undefined;

  assert.ok(sourceRecord);

  const result = mapDiscGolfMetrixPlayerRecord(sourceRecord!, {
    competitionId: "competition-103",
    metrixId: "metrix-103",
    index: 1,
  });

  assert.equal(result.ok, false);

  if (result.ok) {
    return;
  }

  assert.equal(result.issue.code, "invalid_player_record");
  assert.equal(result.issue.stage, "validation");
  assert.equal(result.issue.recordKey, "player:player-4");
});

test("mapDiscGolfMetrixPlayersFromResults skips incomplete player fragments without stopping the batch", () => {
  const result = mapDiscGolfMetrixPlayersFromResults([
    multiPlayerResultsFixture,
    incompletePlayerResultsFixture,
  ]);

  assert.equal(result.players.length, 2);
  assert.equal(result.skippedCount, 2);
  assert.equal(result.issues.length, 1);
  assert.equal(result.issues[0]?.code, "invalid_player_record");
  assert.equal(result.issues[0]?.recordKey, "player:player-4");
});

test("mapDiscGolfMetrixPlayersFromResults skips player fragments without playerId silently", () => {
  const result = mapDiscGolfMetrixPlayersFromResults([
    {
      ...multiPlayerResultsFixture,
      competitionId: "competition-104",
      rawPayload: {
        Competition: {
          Results: [
            { UserID: "player-5", Name: "Alex Smirnov", Place: 1 },
            { Name: "No Id Player", Place: 2 },
          ],
        },
      },
    },
  ]);

  assert.equal(result.players.length, 1);
  assert.equal(result.players[0]?.playerId, "player-5");
  assert.equal(result.skippedCount, 1);
  assert.equal(result.issues.length, 0);
});
