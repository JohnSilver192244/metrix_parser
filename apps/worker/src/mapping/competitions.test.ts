import assert from "node:assert/strict";
import test from "node:test";

import { toCompetitionDbRecord } from "@metrix-parser/shared-types";

import {
  brokenRussianCompetitionFixture,
  nonRussianCompetitionFixture,
  russianCompetitionByCountryNameFixture,
  russianCompetitionFixture,
  russianCompetitionWithoutCountryMetadataFixture,
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
  assert.equal(result.errorCount, 0);
  assert.equal(result.issues.length, 0);
  assert.equal(result.competitions.length, 2);
  assert.deepEqual(result.competitions[0], {
    competitionId: "101",
    competitionName: "Moscow Open",
    competitionDate: "2026-04-12",
    parentId: "9001",
    courseId: "45374",
    courseName: "Tiraz Park",
    recordType: "4",
    playersCount: 72,
    metrixId: null,
  });
  assert.deepEqual(result.competitions[1], {
    competitionId: "102",
    competitionName: "Saint Petersburg Cup",
    competitionDate: "2026-04-13",
    parentId: null,
    courseId: "45375",
    courseName: "Primorsky Park",
    recordType: "2",
    playersCount: 54,
    metrixId: null,
  });
  assert.deepEqual(toCompetitionDbRecord(result.competitions[0]!), {
    competition_id: "101",
    competition_name: "Moscow Open",
    competition_date: "2026-04-12",
    parent_id: "9001",
    course_id: "45374",
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
  assert.equal(result.errorCount, 1);
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
  assert.equal(result.errorCount, 0);
  assert.equal(result.issues.length, 0);
  assert.equal(result.competitions.length, 1);
  assert.equal(result.competitions[0]?.competitionId, "101");
});

test("mapDiscGolfMetrixCompetitions keeps country-scoped records even when payload omits country fields", () => {
  const result = mapDiscGolfMetrixCompetitions([
    russianCompetitionWithoutCountryMetadataFixture,
  ]);

  assert.equal(result.filteredOutCount, 0);
  assert.equal(result.skippedCount, 0);
  assert.equal(result.errorCount, 0);
  assert.equal(result.issues.length, 0);
  assert.equal(result.competitions.length, 1);
  assert.equal(result.competitions[0]?.competitionId, "401");
  assert.equal(result.competitions[0]?.courseId, "45376");
});

test("mapDiscGolfMetrixCompetitions keeps stable course ids from competition payloads", () => {
  const result = mapDiscGolfMetrixCompetitions([
    {
      ID: "501",
      Name: "Course-linked Cup",
      Date: "2026-03-22",
      CourseID: "45374",
    },
  ]);

  assert.equal(result.competitions.length, 1);
  assert.equal(result.competitions[0]?.courseId, "45374");
});

test("mapDiscGolfMetrixCompetitions keeps parent ids from competition payloads", () => {
  const result = mapDiscGolfMetrixCompetitions([
    {
      ID: "601",
      Name: "Final Round",
      Date: "2026-03-22",
      ParentID: "501",
      CourseID: "45377",
    },
  ]);

  assert.equal(result.competitions.length, 1);
  assert.equal(result.competitions[0]?.parentId, "501");
});

test("mapDiscGolfMetrixCompetitions skips competitions without course ids", () => {
  const result = mapDiscGolfMetrixCompetitions([
    {
      ID: "602",
      Name: "Parkless Cup",
      Date: "2026-03-22",
      CountryCode: "RU",
      PlayersCount: "16",
    },
    russianCompetitionFixture,
  ]);

  assert.equal(result.filteredOutCount, 0);
  assert.equal(result.skippedCount, 1);
  assert.equal(result.errorCount, 1);
  assert.equal(result.competitions.length, 1);
  assert.equal(result.issues.length, 1);
  assert.equal(result.issues[0]?.code, "invalid_competition_record");
  assert.equal(result.issues[0]?.message, "Competition record is missing required field: courseId.");
  assert.equal(result.issues[0]?.recordKey, "competition:602");
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
  assert.equal(result.errorCount, 1);
  assert.equal(result.competitions.length, 1);
  assert.equal(result.issues.length, 1);
  assert.equal(result.issues[0]?.code, "invalid_competition_record");
  assert.equal(result.issues[0]?.recordKey, "competition:401");
});

test("mapDiscGolfMetrixCompetitions skips competitions with fewer than eight players without counting them as errors", () => {
  const result = mapDiscGolfMetrixCompetitions([
    {
      ID: "701",
      Name: "Small Cup",
      Date: "2026-03-22",
      CountryCode: "RU",
      PlayersCount: "7",
      CourseID: "45378",
    },
    {
      ID: "702",
      Name: "Borderline Cup",
      Date: "2026-03-23",
      CountryCode: "RU",
      PlayersCount: "8",
      CourseID: "45379",
    },
    russianCompetitionFixture,
  ]);

  assert.equal(result.filteredOutCount, 0);
  assert.equal(result.skippedCount, 1);
  assert.equal(result.errorCount, 0);
  assert.equal(result.competitions.length, 2);
  assert.equal(result.issues.length, 1);
  assert.equal(result.issues[0]?.code, "competition_zero_players");
  assert.equal(result.issues[0]?.message, "< 8 players");
  assert.equal(result.issues[0]?.recordKey, "competition:701");
  assert.equal(result.competitions[0]?.competitionId, "702");
  assert.equal(result.competitions[1]?.competitionId, "101");
});
