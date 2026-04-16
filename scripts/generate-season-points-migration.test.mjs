import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  buildSeasonPointsMigrationSql,
  extractSeasonPointsEntries,
} from "./generate-season-points-migration.mjs";

const fixturePath =
  "/Users/andreynikolaev/Downloads/ДГ Россия 2026 - Таблица Баллов 2026 (2).csv";

test("extractSeasonPointsEntries parses the triangular matrix from CSV", () => {
  const csvText = fs.readFileSync(fixturePath, "utf8");
  const entries = extractSeasonPointsEntries(csvText);

  assert.equal(entries.length, 2600);
  assert.deepEqual(entries[0], {
    playersCount: 8,
    placement: 1,
    points: 55,
  });
  assert.deepEqual(
    entries.find((entry) => entry.playersCount === 42 && entry.placement === 1),
    {
      playersCount: 42,
      placement: 1,
      points: 80,
    },
  );
  assert.deepEqual(
    entries.find((entry) => entry.playersCount === 72 && entry.placement === 72),
    {
      playersCount: 72,
      placement: 72,
      points: 4,
    },
  );
});

test("buildSeasonPointsMigrationSql duplicates the matrix for 2025 and 2026", () => {
  const csvText = fs.readFileSync(fixturePath, "utf8");
  const sql = buildSeasonPointsMigrationSql(csvText);

  assert.match(sql, /delete from app_public\.season_points_table/);
  assert.match(sql, /delete from app_public\.season_standings/);
  assert.match(sql, /values \('2025'\), \('2026'\)/);
  assert.match(sql, /\(8, 1, 55\.00\)/);
  assert.match(sql, /\(72, 72, 4\.00\)/);
});
