import assert from "node:assert/strict";
import test from "node:test";

import type { TournamentCategory } from "@metrix-parser/shared-types";

import {
  calculateCompetitionCourseRating,
  filterCompetitions,
  filterVisibleCompetitions,
  formatCompetitionRecordType,
  isVisibleCompetitionRecordType,
  resolveCompetitionCategoryIdByMetrics,
  resolveCompetitionDisplayName,
  resolveCompetitionSegmentsCount,
  UNCATEGORIZED_COMPETITION_FILTER_VALUE,
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

test("filterCompetitions filters by name substring, date range, course name, category, and missing results", () => {
  const competitions = [
    {
      competitionId: "competition-1",
      competitionName: "RDGA Spring Open",
      competitionDate: "2026-04-10",
      courseId: "course-1",
      courseName: null,
      categoryId: "category-pro",
      recordType: "4",
      playersCount: 24,
      metrixId: null,
      hasResults: true,
    },
    {
      competitionId: "competition-2",
      competitionName: "Autumn Cup",
      competitionDate: "2026-04-11",
      courseId: "course-2",
      courseName: null,
      categoryId: "category-am",
      recordType: "4",
      playersCount: 18,
      metrixId: null,
      hasResults: false,
    },
    {
      competitionId: "competition-3",
      competitionName: "Uncategorized Event",
      competitionDate: "2026-04-12",
      courseId: "course-2",
      courseName: null,
      categoryId: null,
      recordType: "4",
      playersCount: 12,
      metrixId: null,
      hasResults: true,
    },
  ];
  const courseNamesById = {
    "course-1": "Forest Park",
    "course-2": "River Park",
  };

  assert.deepEqual(
    filterCompetitions(competitions, courseNamesById, {
      nameQuery: "spring",
      dateFrom: "",
      dateTo: "",
      courseName: "",
      categoryId: "",
      withoutResultsOnly: false,
    }).map((competition) => competition.competitionId),
    ["competition-1"],
  );

  assert.deepEqual(
    filterCompetitions(competitions, courseNamesById, {
      nameQuery: "",
      dateFrom: "2026-04-11",
      dateTo: "2026-04-11",
      courseName: "",
      categoryId: "",
      withoutResultsOnly: false,
    }).map((competition) => competition.competitionId),
    ["competition-2"],
  );

  assert.deepEqual(
    filterCompetitions(competitions, courseNamesById, {
      nameQuery: "",
      dateFrom: "",
      dateTo: "",
      courseName: "Forest Park",
      categoryId: "",
      withoutResultsOnly: false,
    }).map((competition) => competition.competitionId),
    ["competition-1"],
  );

  assert.deepEqual(
    filterCompetitions(competitions, courseNamesById, {
      nameQuery: "",
      dateFrom: "",
      dateTo: "",
      courseName: "",
      categoryId: UNCATEGORIZED_COMPETITION_FILTER_VALUE,
      withoutResultsOnly: false,
    }).map((competition) => competition.competitionId),
    ["competition-3"],
  );

  assert.deepEqual(
    filterCompetitions(competitions, courseNamesById, {
      nameQuery: "cup",
      dateFrom: "2026-04-01",
      dateTo: "2026-04-30",
      courseName: "River Park",
      categoryId: "category-am",
      withoutResultsOnly: false,
    }).map((competition) => competition.competitionId),
    ["competition-2"],
  );

  assert.deepEqual(
    filterCompetitions(competitions, courseNamesById, {
      nameQuery: "",
      dateFrom: "2026-04-09",
      dateTo: "2026-04-10",
      courseName: "",
      categoryId: "",
      withoutResultsOnly: false,
    }).map((competition) => competition.competitionId),
    ["competition-1"],
  );

  assert.deepEqual(
    filterCompetitions(competitions, courseNamesById, {
      nameQuery: "",
      dateFrom: "",
      dateTo: "",
      courseName: "",
      categoryId: "category-pro",
      withoutResultsOnly: false,
    }).map((competition) => competition.competitionId),
    ["competition-1"],
  );

  assert.deepEqual(
    filterCompetitions(competitions, courseNamesById, {
      nameQuery: "",
      dateFrom: "2026-04-01",
      dateTo: "2026-04-30",
      courseName: "",
      categoryId: "",
      withoutResultsOnly: true,
    }).map((competition) => competition.competitionId),
    ["competition-2"],
  );
});

test("calculateCompetitionCourseRating returns interpolated rating and handles missing values", () => {
  assert.equal(
    calculateCompetitionCourseRating({
      courseId: "course-1",
      name: "Course 1",
      fullname: null,
      type: null,
      countryCode: "RU",
      area: "Moscow",
      ratingValue1: 840,
      ratingResult1: 50,
      ratingValue2: 900,
      ratingResult2: 44,
      coursePar: 54,
      basketsCount: 18,
    }),
    800,
  );

  assert.equal(
    calculateCompetitionCourseRating({
      courseId: "course-2",
      name: "Course 2",
      fullname: null,
      type: null,
      countryCode: "RU",
      area: "Moscow",
      ratingValue1: null,
      ratingResult1: 50,
      ratingValue2: 900,
      ratingResult2: 44,
      coursePar: 54,
      basketsCount: 18,
    }),
    null,
  );
});

test("resolveCompetitionSegmentsCount sums baskets for child rounds when present", () => {
  const competitionsByParentId = new Map([
    [
      "competition-parent",
      [
        {
          competitionId: "competition-round-1",
          competitionName: "R1",
          competitionDate: "2026-01-01",
          parentId: "competition-parent",
          courseId: "course-1",
          courseName: null,
          recordType: "2",
          playersCount: 20,
          metrixId: null,
        },
        {
          competitionId: "competition-round-2",
          competitionName: "R2",
          competitionDate: "2026-01-01",
          parentId: "competition-parent",
          courseId: "course-2",
          courseName: null,
          recordType: "2",
          playersCount: 20,
          metrixId: null,
        },
      ],
    ],
  ]);

  const courseById = new Map([
    [
      "course-1",
      {
        courseId: "course-1",
        name: "Course 1",
        fullname: null,
        type: null,
        countryCode: "RU",
        area: "Moscow",
        ratingValue1: null,
        ratingResult1: null,
        ratingValue2: null,
        ratingResult2: null,
        coursePar: 54,
        basketsCount: 18,
      },
    ],
    [
      "course-2",
      {
        courseId: "course-2",
        name: "Course 2",
        fullname: null,
        type: null,
        countryCode: "RU",
        area: "Moscow",
        ratingValue1: null,
        ratingResult1: null,
        ratingValue2: null,
        ratingResult2: null,
        coursePar: 54,
        basketsCount: 27,
      },
    ],
  ]);

  assert.equal(
    resolveCompetitionSegmentsCount(
      {
        competitionId: "competition-parent",
        competitionName: "Main event",
        competitionDate: "2026-01-01",
        courseId: "course-parent",
        courseName: null,
        recordType: "4",
        playersCount: 20,
        metrixId: null,
      },
      competitionsByParentId,
      courseById,
    ),
    45,
  );
});

test("resolveCompetitionDisplayName uses the parent plus pool name for event rows", () => {
  const competitions = [
    {
      competitionId: "event-1",
      competitionName: "Tour 2026 &rarr; Stage 1",
      competitionDate: "2026-04-26",
      courseId: null,
      courseName: null,
      recordType: "4",
      playersCount: null,
      metrixId: null,
    },
    {
      competitionId: "pool-1",
      competitionName: "Tour 2026 &rarr; Stage 1 &rarr; Experienced",
      competitionDate: "2026-04-26",
      parentId: "event-1",
      courseId: null,
      courseName: null,
      recordType: "3",
      playersCount: null,
      metrixId: null,
    },
    {
      competitionId: "round-1",
      competitionName: "Round 1",
      competitionDate: "2026-04-26",
      parentId: "pool-1",
      courseId: null,
      courseName: null,
      recordType: "1",
      playersCount: null,
      metrixId: null,
    },
  ] as const;

  assert.equal(
    resolveCompetitionDisplayName(competitions[0], competitions),
    "Stage 1 · Experienced",
  );
});

test("resolveCompetitionCategoryIdByMetrics picks the best matching category", () => {
  const categories: TournamentCategory[] = [
    {
      categoryId: "league",
      name: "Лига",
      description: "18+",
      competitionClass: "league",
      segmentsCount: 18,
      ratingGte: 0,
      ratingLt: 1000,
      coefficient: 1,
    },
    {
      categoryId: "tournament",
      name: "Турнир",
      description: "54+",
      competitionClass: "tournament",
      segmentsCount: 54,
      ratingGte: 0,
      ratingLt: 1000,
      coefficient: 1,
    },
  ];

  assert.equal(resolveCompetitionCategoryIdByMetrics(categories, 60, 850), "tournament");
  assert.equal(resolveCompetitionCategoryIdByMetrics(categories, 12, 850), null);
  assert.equal(resolveCompetitionCategoryIdByMetrics(categories, 60, null), null);
});
