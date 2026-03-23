import assert from "node:assert/strict";
import test from "node:test";

import { toCompetitionDbRecord } from "@metrix-parser/shared-types";

import {
  brokenRussianCompetitionFixture,
  nonRussianCompetitionFixture,
  russianCompetitionByCountryNameFixture,
  russianCompetitionFixture,
} from "./__fixtures__/competitions";
import { mapDiscGolfMetrixCompetitions } from "./competitions";

test("mapDiscGolfMetrixCompetitions maps documented DiscGolfMetrix competition fields", () => {
  const result = mapDiscGolfMetrixCompetitions([
    russianCompetitionFixture,
    russianCompetitionByCountryNameFixture,
    nonRussianCompetitionFixture,
  ]);

  assert.equal(result.filteredOutCount, 1);
  assert.equal(result.skippedCount, 0);
  assert.equal(result.issues.length, 0);
  assert.equal(result.competitions.length, 2);
  assert.deepEqual(result.competitions[0], {
    competitionId: "101",
    competitionName: "Moscow Open",
    competitionDate: "2026-04-12",
    courseName: "Tiraz Park",
    recordType: "4",
    playersCount: 72,
    metrixId: null,
  });
  assert.deepEqual(result.competitions[1], {
    competitionId: "102",
    competitionName: "Saint Petersburg Cup",
    competitionDate: "2026-04-13",
    courseName: "Primorsky Park",
    recordType: "2",
    playersCount: 54,
    metrixId: null,
  });
  assert.deepEqual(toCompetitionDbRecord(result.competitions[0]!), {
    competition_id: "101",
    competition_name: "Moscow Open",
    competition_date: "2026-04-12",
    course_name: "Tiraz Park",
    record_type: "4",
    players_count: 72,
    metrix_id: null,
  });
});

test("mapDiscGolfMetrixCompetitions skips broken records without stopping the whole batch", () => {
  const result = mapDiscGolfMetrixCompetitions([
    brokenRussianCompetitionFixture,
    russianCompetitionFixture,
  ]);

  assert.equal(result.filteredOutCount, 0);
  assert.equal(result.skippedCount, 1);
  assert.equal(result.competitions.length, 1);
  assert.equal(result.issues.length, 1);
  assert.equal(result.issues[0]?.code, "invalid_competition_record");
  assert.equal(result.issues[0]?.stage, "validation");
  assert.equal(result.issues[0]?.recordKey, "competition:301");
});

test("mapDiscGolfMetrixCompetitions filters out non-Russian records before persistence", () => {
  const result = mapDiscGolfMetrixCompetitions([
    nonRussianCompetitionFixture,
    russianCompetitionFixture,
  ]);

  assert.equal(result.filteredOutCount, 1);
  assert.equal(result.skippedCount, 0);
  assert.equal(result.issues.length, 0);
  assert.equal(result.competitions.length, 1);
  assert.equal(result.competitions[0]?.competitionId, "101");
});

test("mapDiscGolfMetrixCompetitions skips Russian records with impossible calendar dates", () => {
  const result = mapDiscGolfMetrixCompetitions([
    {
      ID: "401",
      Name: "Invalid Date Cup",
      Date: "2026-02-31",
      CountryCode: "RU",
    },
    russianCompetitionFixture,
  ]);

  assert.equal(result.filteredOutCount, 0);
  assert.equal(result.skippedCount, 1);
  assert.equal(result.competitions.length, 1);
  assert.equal(result.issues.length, 1);
  assert.equal(result.issues[0]?.code, "invalid_competition_record");
  assert.equal(result.issues[0]?.recordKey, "competition:401");
});
