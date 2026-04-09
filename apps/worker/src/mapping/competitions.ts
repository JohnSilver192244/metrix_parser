import {
  createUpdateIssue,
  type Competition,
  type UpdateProcessingIssue,
} from "@metrix-parser/shared-types";

import type { DiscGolfMetrixRawCompetitionRecord } from "../integration/discgolfmetrix";
import {
  readOptionalDateField,
  readOptionalNumberField,
  readOptionalStringField,
} from "../parsing/competition-record";

function buildRecordKey(
  record: DiscGolfMetrixRawCompetitionRecord,
  index: number,
): string {
  const candidateId = readOptionalStringField(record, [
    "competitionId",
    "competition_id",
    "id",
    "ID",
    "metrixId",
    "metrix_id",
  ]);

  return candidateId ? `competition:${candidateId}` : `competition:index-${index}`;
}

function readCompetitionId(
  record: DiscGolfMetrixRawCompetitionRecord,
): string | null {
  return (
    readOptionalStringField(record, [
      "competitionId",
      "competition_id",
      "id",
      "ID",
    ]) ?? null
  );
}

function readCompetitionCourseId(
  record: DiscGolfMetrixRawCompetitionRecord,
): string | null {
  return (
    readOptionalStringField(record, [
      "CourceID",
      "CourseID",
      "courseId",
      "course_id",
      "courseid",
      "layoutId",
      "layout_id",
    ]) ?? null
  );
}

function buildParentCompetitionCourseIds(
  records: readonly DiscGolfMetrixRawCompetitionRecord[],
): Map<string, string> {
  const parentCompetitionCourseIds = new Map<string, string>();

  records.forEach((record) => {
    const parentId =
      readOptionalStringField(record, [
        "ParentID",
        "parentId",
        "parent_id",
      ]) ?? null;
    const courseId = readCompetitionCourseId(record);

    if (!parentId || !courseId || parentCompetitionCourseIds.has(parentId)) {
      return;
    }

    parentCompetitionCourseIds.set(parentId, courseId);
  });

  return parentCompetitionCourseIds;
}

function toInvalidCompetitionIssue(
  recordKey: string,
  missingField: string,
): UpdateProcessingIssue {
  return createUpdateIssue({
    code: "invalid_competition_record",
    message: `В записи соревнования отсутствует обязательное поле: ${missingField}.`,
    recoverable: true,
    stage: "validation",
    recordKey,
  });
}

const MIN_COMPETITION_PLAYERS = 8;

function toTooFewPlayersCompetitionIssue(
  recordKey: string,
): UpdateProcessingIssue {
  return createUpdateIssue({
    code: "competition_zero_players",
    message: `Меньше ${MIN_COMPETITION_PLAYERS} игроков`,
    recoverable: true,
    stage: "validation",
    recordKey,
  });
}

export interface CompetitionMappingResult {
  entries: CompetitionMappingEntry[];
  competitions: Competition[];
  filteredOutCount: number;
  skippedCount: number;
  errorCount: number;
  issues: UpdateProcessingIssue[];
}

export interface CompetitionMappingEntry {
  competition: Competition;
  rawRecord: DiscGolfMetrixRawCompetitionRecord;
}

const RUSSIAN_COUNTRY_CODES = new Set(["RU", "RUS"]);
const RUSSIAN_COUNTRY_NAMES = new Set([
  "russia",
  "russian federation",
  "rossiya",
  "rossiyskaya federatsiya",
  "россия",
  "российская федерация",
]);
const EXCLUDED_COMPETITION_NAME_FRAGMENTS = [
  "мастер-класс",
  "master class",
  "даблс",
  "doubles",
  "скинс",
  "skins",
] as const;
const COMPETITION_NAME_DASH_PATTERN = /[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g;
const COMPETITION_NAME_WHITESPACE_PATTERN = /\s+/g;

function normalizeCountryValue(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeCompetitionNameForFiltering(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(COMPETITION_NAME_DASH_PATTERN, "-")
    .replace(COMPETITION_NAME_WHITESPACE_PATTERN, " ")
    .trim();
}

function hasExcludedCompetitionName(
  record: DiscGolfMetrixRawCompetitionRecord,
): boolean {
  const competitionName = readOptionalStringField(record, [
    "competitionName",
    "competition_name",
    "name",
    "Name",
  ]);

  if (!competitionName) {
    return false;
  }

  const normalizedName = normalizeCompetitionNameForFiltering(competitionName);

  return EXCLUDED_COMPETITION_NAME_FRAGMENTS.some((fragment) =>
    normalizedName.includes(fragment),
  );
}

function isRussianCompetitionRecord(
  record: DiscGolfMetrixRawCompetitionRecord,
): boolean {
  const explicitCountryCode = readOptionalStringField(record, [
    "CountryCode",
    "countryCode",
    "country_code",
  ]);

  if (explicitCountryCode) {
    return RUSSIAN_COUNTRY_CODES.has(explicitCountryCode.trim().toUpperCase());
  }

  const explicitCountryName = readOptionalStringField(record, [
    "Country",
    "country",
    "countryName",
    "country_name",
    "CountryName",
  ]);

  if (explicitCountryName) {
    return RUSSIAN_COUNTRY_NAMES.has(normalizeCountryValue(explicitCountryName));
  }

  // The competitions endpoint is already scoped by country_code, so records without
  // per-record country metadata should still be accepted.
  return true;
}

export function mapDiscGolfMetrixCompetitionRecord(
  record: DiscGolfMetrixRawCompetitionRecord,
  parentCompetitionCourseIds: ReadonlyMap<string, string> = new Map(),
  index = 0,
):
  | { ok: true; competition: Competition }
  | { ok: false; issue: UpdateProcessingIssue } {
  const recordKey = buildRecordKey(record, index);
  const competitionId = readCompetitionId(record);

  if (!competitionId) {
    return { ok: false, issue: toInvalidCompetitionIssue(recordKey, "competitionId") };
  }

  const competitionName = readOptionalStringField(record, [
    "competitionName",
    "competition_name",
    "name",
    "Name",
  ]);

  if (!competitionName) {
    return { ok: false, issue: toInvalidCompetitionIssue(recordKey, "competitionName") };
  }

  const competitionDate = readOptionalDateField(record, [
    "competitionDate",
    "competition_date",
    "date",
    "Date",
    "startDate",
    "start_date",
    "TourDateStart",
  ]);

  if (!competitionDate) {
    return { ok: false, issue: toInvalidCompetitionIssue(recordKey, "competitionDate") };
  }

  const playersCount =
    readOptionalNumberField(record, [
      "playersCount",
      "players_count",
      "playerCount",
      "player_count",
      "players",
      "PlayersCount",
    ]) ?? null;

  if (playersCount !== null && playersCount < MIN_COMPETITION_PLAYERS) {
    return { ok: false, issue: toTooFewPlayersCompetitionIssue(recordKey) };
  }

  const courseId =
    readCompetitionCourseId(record) ?? parentCompetitionCourseIds.get(competitionId) ?? null;

  if (!courseId) {
    return { ok: false, issue: toInvalidCompetitionIssue(recordKey, "courseId") };
  }

  return {
    ok: true,
    competition: {
      competitionId,
      competitionName,
      competitionDate,
      parentId:
        readOptionalStringField(record, [
          "ParentID",
          "parentId",
          "parent_id",
        ]) ?? null,
      courseId,
      courseName:
        readOptionalStringField(record, [
          "courseName",
          "course_name",
          "course",
          "Coursename",
        ]) ?? null,
      // DiscGolfMetrix RecordType mapping:
      // 1 - Round, 2 - Single round event, 3 - Pool, 4 - Event, 5 - Tour.
      recordType:
        readOptionalStringField(record, [
          "recordType",
          "record_type",
          "type",
          "RecordType",
        ]) ?? null,
      playersCount:
        playersCount,
      metrixId: readOptionalStringField(record, ["metrixId", "metrix_id"]) ?? null,
    },
  };
}

export function mapDiscGolfMetrixCompetitions(
  records: readonly DiscGolfMetrixRawCompetitionRecord[],
): CompetitionMappingResult {
  const entries: CompetitionMappingEntry[] = [];
  const competitions: Competition[] = [];
  const issues: UpdateProcessingIssue[] = [];
  const parentCompetitionCourseIds = buildParentCompetitionCourseIds(records);
  let filteredOutCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  records.forEach((record, index) => {
    if (!isRussianCompetitionRecord(record)) {
      filteredOutCount += 1;
      return;
    }

    if (hasExcludedCompetitionName(record)) {
      filteredOutCount += 1;
      return;
    }

    const mapped = mapDiscGolfMetrixCompetitionRecord(
      record,
      parentCompetitionCourseIds,
      index + 1,
    );

    if (!mapped.ok) {
      skippedCount += 1;
      issues.push(mapped.issue);
      if (mapped.issue.code !== "competition_zero_players") {
        errorCount += 1;
      }
      return;
    }

    const entry = {
      competition: mapped.competition,
      rawRecord: record,
    };

    entries.push(entry);
    competitions.push(entry.competition);
  });

  return {
    entries,
    competitions,
    filteredOutCount,
    skippedCount,
    errorCount,
    issues,
  };
}
