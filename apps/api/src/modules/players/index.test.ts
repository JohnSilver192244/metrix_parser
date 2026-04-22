import assert from "node:assert/strict";
import test from "node:test";

import type { PlayerCompetitionResult } from "@metrix-parser/shared-types";

import { aggregateSeasonStandingsByPlayer, alignPlayerResultPlacement } from "./index";

function createPlayerResult(
  overrides: Partial<PlayerCompetitionResult> = {},
): PlayerCompetitionResult {
  return {
    competitionId: "competition-1",
    competitionName: "Test competition",
    competitionDate: "2025-10-04",
    category: "5",
    placement: null,
    sum: 60,
    dnf: true,
    seasonPoints: 72,
    ...overrides,
  };
}

test("alignPlayerResultPlacement preserves existing placement when resolved ranking is missing", () => {
  const row = createPlayerResult({
    placement: 1,
    dnf: false,
  });

  assert.deepEqual(alignPlayerResultPlacement(row, null), row);
});

test("alignPlayerResultPlacement applies resolved placement and clears dnf", () => {
  const row = createPlayerResult({
    placement: null,
    dnf: true,
  });

  assert.deepEqual(alignPlayerResultPlacement(row, 4), {
    ...row,
    placement: 4,
    dnf: false,
  });
});

test("alignPlayerResultPlacement keeps dnf when neither existing nor resolved placement is present", () => {
  const row = createPlayerResult({
    placement: null,
    dnf: true,
  });

  assert.deepEqual(alignPlayerResultPlacement(row, null), row);
});

test("aggregateSeasonStandingsByPlayer keeps full season totals while selecting 4 tournaments, 4 leagues, and 1 championship for credit", () => {
  const playerId = "105169";
  const rows = [
    { competition_id: "3415210", player_id: playerId, category_id: "df336969-b2e8-441b-b0c5-c98407007224", placement: 4, season_points: 264.0 },
    { competition_id: "3198575", player_id: playerId, category_id: "ae3a9ba8-9d92-485e-acea-6d0e5499ebfc", placement: 3, season_points: 217.5 },
    { competition_id: "3242080", player_id: playerId, category_id: "ae3a9ba8-9d92-485e-acea-6d0e5499ebfc", placement: 1, season_points: 216.0 },
    { competition_id: "3186078", player_id: playerId, category_id: "ae3a9ba8-9d92-485e-acea-6d0e5499ebfc", placement: 4, season_points: 198.0 },
    { competition_id: "3264746", player_id: playerId, category_id: "0c9ef4c4-af1c-45f2-9f79-7b829b36fe16", placement: 1, season_points: 72.0 },
    { competition_id: "3464441", player_id: playerId, category_id: "86b29366-20bb-4326-976f-e804e9e3b025", placement: 1, season_points: 64.0 },
    { competition_id: "3264745", player_id: playerId, category_id: "0c9ef4c4-af1c-45f2-9f79-7b829b36fe16", placement: 2, season_points: 63.0 },
    { competition_id: "3390010", player_id: playerId, category_id: "676507e7-d22c-4712-a027-e4cfd4c11046", placement: 1, season_points: 59.15 },
    { competition_id: "3264739", player_id: playerId, category_id: "0c9ef4c4-af1c-45f2-9f79-7b829b36fe16", placement: 1, season_points: 56.0 },
    { competition_id: "3434347", player_id: playerId, category_id: "676507e7-d22c-4712-a027-e4cfd4c11046", placement: 1, season_points: 54.95 },
    { competition_id: "3447827", player_id: playerId, category_id: "676507e7-d22c-4712-a027-e4cfd4c11046", placement: 2, season_points: 51.1 },
    { competition_id: "3398368", player_id: playerId, category_id: "676507e7-d22c-4712-a027-e4cfd4c11046", placement: 2, season_points: 49.7 },
    { competition_id: "3498138", player_id: playerId, category_id: "86b29366-20bb-4326-976f-e804e9e3b025", placement: 3, season_points: 48.0 },
    { competition_id: "3483744", player_id: playerId, category_id: "86b29366-20bb-4326-976f-e804e9e3b025", placement: 5, season_points: 40.4 },
    { competition_id: "3349506", player_id: playerId, category_id: "676507e7-d22c-4712-a027-e4cfd4c11046", placement: 9, season_points: 37.38 },
    { competition_id: "3264729", player_id: playerId, category_id: "0c9ef4c4-af1c-45f2-9f79-7b829b36fe16", placement: 9, season_points: 35.7 },
    { competition_id: "3299525", player_id: playerId, category_id: "676507e7-d22c-4712-a027-e4cfd4c11046", placement: 34, season_points: 16.59 },
    { competition_id: "3500000", player_id: playerId, category_id: "championship-category-id", placement: 2, season_points: 300.0 },
    { competition_id: "3500001", player_id: playerId, category_id: "championship-category-id", placement: 8, season_points: 280.0 },
  ];

  const result = aggregateSeasonStandingsByPlayer(
    rows,
    {
      bestLeaguesCount: 4,
      bestTournamentsCount: 4,
      bestChampionshipsCount: 1,
      competitionClassByCategoryId: new Map([
        ["0c9ef4c4-af1c-45f2-9f79-7b829b36fe16", "league"],
        ["676507e7-d22c-4712-a027-e4cfd4c11046", "league"],
        ["86b29366-20bb-4326-976f-e804e9e3b025", "league"],
        ["ae3a9ba8-9d92-485e-acea-6d0e5499ebfc", "tournament"],
        ["df336969-b2e8-441b-b0c5-c98407007224", "tournament"],
        ["championship-category-id", "championship"],
      ]),
    },
    new Map(rows.map((row) => [row.competition_id, row.competition_id])),
  );

  assert.equal(result.seasonPointsByPlayerId.get(playerId), 2123.4700000000003);
  assert.equal(result.seasonCompetitionCountByPlayerId.get(playerId), 19);
  assert.equal(result.seasonCreditPointsByPlayerId.get(playerId), 1453.65);
  assert.deepEqual(
    result.seasonCreditCompetitionsByPlayerId.get(playerId)?.map((row) => row.competitionId),
    ["3500000", "3415210", "3198575", "3242080", "3186078", "3264746", "3464441", "3264745", "3390010"],
  );
  assert.deepEqual(
    result.seasonCreditCompetitionsByPlayerId
      .get(playerId)
      ?.map((row) => row.competitionClass),
    [
      "championship",
      "tournament",
      "tournament",
      "tournament",
      "tournament",
      "league",
      "league",
      "league",
      "league",
    ],
  );
});
