import assert from "node:assert/strict";
import test from "node:test";

import { toCompetitionResultDbRecord } from "@metrix-parser/shared-types";

import {
  dnfCompetitionResultsFixture,
  incompleteCompetitionResultsFixture,
  regularCompetitionResultsFixture,
} from "./__fixtures__/competition-results";
import {
  mapDiscGolfMetrixCompetitionResultRecord,
  mapDiscGolfMetrixCompetitionResults,
} from "./competition-results";

test("mapDiscGolfMetrixCompetitionResults maps regular result records into the shared domain model", () => {
  const result = mapDiscGolfMetrixCompetitionResults([regularCompetitionResultsFixture]);

  assert.equal(result.skippedCount, 0);
  assert.equal(result.issues.length, 0);
  assert.equal(result.results.length, 1);
  assert.deepEqual(result.results[0], {
    competitionId: "competition-101",
    playerId: "player-1",
    className: "MPO",
    sum: 54,
    diff: -6,
    dnf: false,
  });
  assert.deepEqual(toCompetitionResultDbRecord(result.results[0]!), {
    competition_id: "competition-101",
    player_id: "player-1",
    class_name: "MPO",
    sum: 54,
    diff: -6,
    dnf: false,
    season_points: null,
  });
});

test("mapDiscGolfMetrixCompetitionResults keeps DNF as a separate logical state", () => {
  const result = mapDiscGolfMetrixCompetitionResults([dnfCompetitionResultsFixture]);

  assert.equal(result.skippedCount, 0);
  assert.equal(result.issues.length, 0);
  assert.equal(result.results.length, 1);
  assert.deepEqual(result.results[0], {
    competitionId: "competition-102",
    playerId: "player-2",
    className: "MA3",
    sum: null,
    diff: null,
    dnf: true,
  });
});

test("mapDiscGolfMetrixCompetitionResults treats string DNF flag '1' as DNF", () => {
  const result = mapDiscGolfMetrixCompetitionResults([
    {
      ...regularCompetitionResultsFixture,
      competitionId: "competition-106",
      rawPayload: {
        Competition: {
          Results: [
            {
              UserID: "32953",
              Name: "Aleksey Trunilin",
              ClassName: "",
              Sum: 30,
              Diff: 7,
              DNF: "1",
            },
          ],
        },
      },
    },
  ]);

  assert.equal(result.skippedCount, 0);
  assert.equal(result.issues.length, 0);
  assert.equal(result.results.length, 1);
  assert.deepEqual(result.results[0], {
    competitionId: "competition-106",
    playerId: "32953",
    className: null,
    sum: 30,
    diff: 7,
    dnf: true,
  });
});

test("mapDiscGolfMetrixCompetitionResults infers DNF from incomplete PlayerResults", () => {
  const result = mapDiscGolfMetrixCompetitionResults([
    {
      ...regularCompetitionResultsFixture,
      competitionId: "competition-107",
      rawPayload: {
        Competition: {
          Tracks: [{ HoleNumber: 1 }, { HoleNumber: 2 }, { HoleNumber: 3 }],
          Results: [
            {
              UserID: "player-7",
              Name: "Roman Romanov",
              Class: "MPO",
              Sum: 56,
              Diff: -4,
              PlayerResults: [
                { Result: 3 },
                { Result: 4 },
              ],
            },
          ],
        },
      },
    },
  ]);

  assert.equal(result.skippedCount, 0);
  assert.equal(result.issues.length, 0);
  assert.deepEqual(result.results[0], {
    competitionId: "competition-107",
    playerId: "player-7",
    className: "MPO",
    sum: 56,
    diff: -4,
    dnf: true,
  });
});

test("mapDiscGolfMetrixCompetitionResults keeps completed PlayerResults ranked", () => {
  const result = mapDiscGolfMetrixCompetitionResults([
    {
      ...regularCompetitionResultsFixture,
      competitionId: "competition-108",
      rawPayload: {
        Competition: {
          Tracks: [{ HoleNumber: 1 }, { HoleNumber: 2 }, { HoleNumber: 3 }],
          Results: [
            {
              UserID: "player-8",
              Name: "Kirill Kirillov",
              Class: "MPO",
              Sum: 51,
              Diff: -9,
              PlayerResults: [
                { Result: 3 },
                { Result: 3 },
                { Result: 3 },
              ],
            },
          ],
        },
      },
    },
  ]);

  assert.equal(result.skippedCount, 0);
  assert.equal(result.issues.length, 0);
  assert.deepEqual(result.results[0], {
    competitionId: "competition-108",
    playerId: "player-8",
    className: "MPO",
    sum: 51,
    diff: -9,
    dnf: false,
  });
});

test("mapDiscGolfMetrixCompetitionResults accepts result records without class name", () => {
  const result = mapDiscGolfMetrixCompetitionResults([
    {
      ...regularCompetitionResultsFixture,
      competitionId: "competition-104",
      rawPayload: {
        Competition: {
          Results: [
            {
              UserID: "player-4",
              Name: "Alex Smirnov",
              Sum: 57,
              Diff: -3,
              Place: 4,
            },
          ],
        },
      },
    },
  ]);

  assert.equal(result.skippedCount, 0);
  assert.equal(result.issues.length, 0);
  assert.equal(result.results.length, 1);
  assert.equal(result.results[0]?.className, null);
});

test("mapDiscGolfMetrixCompetitionResultRecord rejects incomplete non-DNF result fragments", () => {
  const competitionSection = incompleteCompetitionResultsFixture.rawPayload
    .Competition as { Results?: unknown[] } | undefined;
  const sourceRecord = competitionSection?.Results?.[0] as
    | Record<string, unknown>
    | undefined;

  assert.ok(sourceRecord);

  const result = mapDiscGolfMetrixCompetitionResultRecord(sourceRecord!, {
    competitionId: "competition-103",
    metrixId: "metrix-103",
    index: 1,
  });

  assert.equal(result.ok, false);

  if (result.ok) {
    return;
  }

  assert.equal(result.issue.code, "invalid_competition_result_record");
  assert.equal(result.issue.stage, "validation");
  assert.equal(result.issue.recordKey, "competition:competition-103:player:player-3");
});

test("mapDiscGolfMetrixCompetitionResults skips incomplete result fragments without stopping the batch", () => {
  const result = mapDiscGolfMetrixCompetitionResults([
    regularCompetitionResultsFixture,
    incompleteCompetitionResultsFixture,
  ]);

  assert.equal(result.results.length, 1);
  assert.equal(result.skippedCount, 1);
  assert.equal(result.issues.length, 1);
  assert.equal(result.issues[0]?.code, "invalid_competition_result_record");
});

test("mapDiscGolfMetrixCompetitionResults skips result fragments without playerId silently", () => {
  const result = mapDiscGolfMetrixCompetitionResults([
    {
      ...regularCompetitionResultsFixture,
      competitionId: "competition-105",
      rawPayload: {
        Competition: {
          Results: [
            {
              UserID: "player-5",
              Name: "Alex Smirnov",
              Class: "MPO",
              Sum: 53,
              Diff: -7,
              Place: 1,
            },
            {
              Name: "No Id Player",
              Class: "MA3",
              Sum: 57,
              Diff: -3,
              Place: 2,
            },
          ],
        },
      },
    },
  ]);

  assert.equal(result.results.length, 1);
  assert.equal(result.results[0]?.playerId, "player-5");
  assert.equal(result.skippedCount, 1);
  assert.equal(result.issues.length, 0);
});
