import assert from "node:assert/strict";
import test from "node:test";

import {
  filterVisibleCompetitions,
  formatCompetitionRecordType,
  isVisibleCompetitionRecordType,
} from "./competition-presenters";

test("formatCompetitionRecordType maps documented DiscGolfMetrix record types", () => {
  assert.equal(formatCompetitionRecordType("1"), "Round");
  assert.equal(formatCompetitionRecordType("2"), "Single round event");
  assert.equal(formatCompetitionRecordType("3"), "Pool");
  assert.equal(formatCompetitionRecordType("4"), "Event");
  assert.equal(formatCompetitionRecordType("5"), "Tour");
  assert.equal(formatCompetitionRecordType(null), "Не указан");
});

test("filterVisibleCompetitions keeps only listable competition types", () => {
  const visibleCompetitions = filterVisibleCompetitions([
    {
      competitionId: "competition-1",
      competitionName: "Round",
      competitionDate: "2026-06-01",
      courseId: null,
      courseName: null,
      recordType: "1",
      playersCount: 10,
      metrixId: null,
    },
    {
      competitionId: "competition-2",
      competitionName: "Single Round Event",
      competitionDate: "2026-06-02",
      courseId: null,
      courseName: null,
      recordType: "2",
      playersCount: 20,
      metrixId: null,
    },
    {
      competitionId: "competition-4",
      competitionName: "Event",
      competitionDate: "2026-06-03",
      courseId: null,
      courseName: null,
      recordType: "4",
      playersCount: 30,
      metrixId: null,
    },
    {
      competitionId: "competition-5",
      competitionName: "Tour",
      competitionDate: "2026-06-04",
      courseId: null,
      courseName: null,
      recordType: "5",
      playersCount: 40,
      metrixId: null,
    },
  ]);

  assert.deepEqual(
    visibleCompetitions.map((competition) => competition.competitionId),
    ["competition-2", "competition-4"],
  );
  assert.equal(isVisibleCompetitionRecordType("2"), true);
  assert.equal(isVisibleCompetitionRecordType("4"), true);
  assert.equal(isVisibleCompetitionRecordType("1"), false);
  assert.equal(isVisibleCompetitionRecordType("5"), false);
});
