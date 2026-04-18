import assert from "node:assert/strict";
import test from "node:test";

import type { PlayerCompetitionResult } from "@metrix-parser/shared-types";

import { alignPlayerResultPlacement } from "./index";

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
