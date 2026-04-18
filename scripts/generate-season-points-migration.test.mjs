import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import {
  DEFAULT_CSV_PATH,
  DEFAULT_OUTPUT_PATH,
  generateSeasonPointsMigrationSql,
  parseSeasonPointsCsv,
} from "./generate-season-points-migration.mjs";

test("parseSeasonPointsCsv parses the repository fixture into a triangular matrix", async () => {
  const csvText = await fs.readFile(DEFAULT_CSV_PATH, "utf8");
  const entries = parseSeasonPointsCsv(csvText);

  assert.equal(entries[0]?.playersCount, 8);
  assert.equal(entries[0]?.placement, 1);
  assert.equal(entries[0]?.points, 40);
  assert.equal(entries.find((entry) => entry.playersCount === 41 && entry.placement === 1)?.points, 79.5);
  assert.equal(entries.find((entry) => entry.playersCount === 41 && entry.placement === 2)?.points, 71.5);
  assert.equal(entries.find((entry) => entry.playersCount === 41 && entry.placement === 3)?.points, 64.5);
  assert.equal(entries.at(-1)?.playersCount, 72);
  assert.equal(entries.at(-1)?.placement, 72);
  assert.equal(entries.at(-1)?.points, 4);
});

test("parseSeasonPointsCsv fails fast on malformed triangular data", () => {
  assert.throws(
    () =>
      parseSeasonPointsCsv([
        "placement,8,9",
        "1,40,43",
        "2,30,33",
        "3,22,25",
        "4,15,17",
        "5,11,12",
        "6,9,10",
        "7,7,8",
        "8,5,6.5",
        "9,4,5",
      ].join("\n")),
    /Unexpected points outside triangular region/,
  );
});

test("generateSeasonPointsMigrationSql matches the checked-in migration", async () => {
  const csvText = await fs.readFile(DEFAULT_CSV_PATH, "utf8");
  const entries = parseSeasonPointsCsv(csvText);
  const expectedSql = await fs.readFile(DEFAULT_OUTPUT_PATH, "utf8");

  assert.equal(generateSeasonPointsMigrationSql(entries), expectedSql);
});
