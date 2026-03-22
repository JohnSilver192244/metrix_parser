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

const RUSSIAN_COUNTRY_CODES = new Set(["RU", "RUS"]);
const RUSSIAN_COUNTRY_NAMES = new Set([
  "russia",
  "russian federation",
  "rossiya",
  "rossiyskaya federatsiya",
  "россия",
  "российская федерация",
]);

function normalizeCountryToken(value: string): string {
  return value.trim().toLowerCase();
}

function buildRecordKey(
  record: DiscGolfMetrixRawCompetitionRecord,
  index: number,
): string {
  const candidateId = readOptionalStringField(record, [
    "competitionId",
    "competition_id",
    "id",
    "metrixId",
    "metrix_id",
  ]);

  return candidateId ? `competition:${candidateId}` : `competition:index-${index}`;
}

export function isDiscGolfMetrixCompetitionInRussia(
  record: DiscGolfMetrixRawCompetitionRecord,
): boolean {
  const countryCode = readOptionalStringField(record, [
    "countryCode",
    "country_code",
  ]);

  if (countryCode) {
    return RUSSIAN_COUNTRY_CODES.has(countryCode.toUpperCase());
  }

  const countryName = readOptionalStringField(record, [
    "country",
    "countryName",
    "country_name",
  ]);

  if (!countryName) {
    return false;
  }

  return RUSSIAN_COUNTRY_NAMES.has(normalizeCountryToken(countryName));
}

function toInvalidCompetitionIssue(
  recordKey: string,
  missingField: string,
): UpdateProcessingIssue {
  return createUpdateIssue({
    code: "invalid_competition_record",
    message: `Competition record is missing required field: ${missingField}.`,
    recoverable: true,
    stage: "validation",
    recordKey,
  });
}

export interface CompetitionMappingResult {
  competitions: Competition[];
  filteredOutCount: number;
  skippedCount: number;
  issues: UpdateProcessingIssue[];
}

export function mapDiscGolfMetrixCompetitionRecord(
  record: DiscGolfMetrixRawCompetitionRecord,
  index = 0,
):
  | { ok: true; competition: Competition }
  | { ok: false; issue: UpdateProcessingIssue } {
  const recordKey = buildRecordKey(record, index);
  const competitionId = readOptionalStringField(record, [
    "competitionId",
    "competition_id",
    "id",
  ]);

  if (!competitionId) {
    return { ok: false, issue: toInvalidCompetitionIssue(recordKey, "competitionId") };
  }

  const competitionName = readOptionalStringField(record, [
    "competitionName",
    "competition_name",
    "name",
  ]);

  if (!competitionName) {
    return { ok: false, issue: toInvalidCompetitionIssue(recordKey, "competitionName") };
  }

  const competitionDate = readOptionalDateField(record, [
    "competitionDate",
    "competition_date",
    "date",
    "startDate",
    "start_date",
  ]);

  if (!competitionDate) {
    return { ok: false, issue: toInvalidCompetitionIssue(recordKey, "competitionDate") };
  }

  return {
    ok: true,
    competition: {
      competitionId,
      competitionName,
      competitionDate,
      courseName:
        readOptionalStringField(record, ["courseName", "course_name", "course"]) ?? null,
      recordType:
        readOptionalStringField(record, ["recordType", "record_type", "type"]) ?? null,
      playersCount:
        readOptionalNumberField(record, [
          "playersCount",
          "players_count",
          "playerCount",
          "player_count",
          "players",
        ]) ?? null,
      metrixId:
        readOptionalStringField(record, ["metrixId", "metrix_id", "eventId", "event_id"]) ??
        null,
    },
  };
}

export function mapDiscGolfMetrixCompetitions(
  records: readonly DiscGolfMetrixRawCompetitionRecord[],
): CompetitionMappingResult {
  const competitions: Competition[] = [];
  const issues: UpdateProcessingIssue[] = [];
  let filteredOutCount = 0;
  let skippedCount = 0;

  records.forEach((record, index) => {
    if (!isDiscGolfMetrixCompetitionInRussia(record)) {
      filteredOutCount += 1;
      return;
    }

    const mapped = mapDiscGolfMetrixCompetitionRecord(record, index + 1);

    if (!mapped.ok) {
      skippedCount += 1;
      issues.push(mapped.issue);
      return;
    }

    competitions.push(mapped.competition);
  });

  return {
    competitions,
    filteredOutCount,
    skippedCount,
    issues,
  };
}
