import { DiscGolfMetrixClientError } from "./errors";
import type {
  DiscGolfMetrixCompetitionsPayload,
  DiscGolfMetrixRawCompetitionRecord,
  DiscGolfMetrixCoursePayload,
  DiscGolfMetrixRawCourseRecord,
  DiscGolfMetrixResultsPayload,
} from "./types";

function isCompetitionRecord(value: unknown): value is DiscGolfMetrixRawCompetitionRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCompetitionsPayload(value: unknown): value is DiscGolfMetrixCompetitionsPayload {
  return isCompetitionRecord(value) && Array.isArray(value.competitions);
}

export function parseDiscGolfMetrixCompetitionsPayload(
  payload: unknown,
): DiscGolfMetrixCompetitionsPayload {
  if (Array.isArray(payload) && payload.every(isCompetitionRecord)) {
    return { competitions: payload };
  }

  if (isCompetitionsPayload(payload) && payload.competitions.every(isCompetitionRecord)) {
    return payload;
  }

  throw new DiscGolfMetrixClientError(
    "DiscGolfMetrix competitions payload has unsupported structure.",
    "discgolfmetrix_parse_error",
  );
}

function isCoursePayload(value: unknown): value is DiscGolfMetrixCoursePayload {
  return isCompetitionRecord(value);
}

function isRecordObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getDocumentedResultsCollection(
  value: Record<string, unknown>,
): unknown[] | null {
  const competition = value.Competition;

  if (!isRecordObject(competition)) {
    return null;
  }

  const results = competition.Results;
  return Array.isArray(results) ? results : null;
}

function hasResultsCollection(
  value: Record<string, unknown>,
): value is DiscGolfMetrixResultsPayload {
  const candidates = ["results", "players", "standings", "scorecards"];

  const documentedResults = getDocumentedResultsCollection(value);

  if (documentedResults && documentedResults.every(isCompetitionRecord)) {
    return true;
  }

  return candidates.some((key) => {
    const collection = value[key];
    return Array.isArray(collection) && collection.every(isCompetitionRecord);
  });
}

export function parseDiscGolfMetrixCoursePayload(
  payload: unknown,
): DiscGolfMetrixCoursePayload {
  if (isCoursePayload(payload)) {
    return payload;
  }

  throw new DiscGolfMetrixClientError(
    "DiscGolfMetrix course payload has unsupported structure.",
    "discgolfmetrix_parse_error",
  );
}

export function parseDiscGolfMetrixResultsPayload(
  payload: unknown,
): DiscGolfMetrixResultsPayload {
  if (Array.isArray(payload) && payload.every(isCompetitionRecord)) {
    return { results: payload };
  }

  if (isCompetitionRecord(payload) && hasResultsCollection(payload)) {
    return payload;
  }

  throw new DiscGolfMetrixClientError(
    "DiscGolfMetrix results payload has unsupported structure.",
    "discgolfmetrix_parse_error",
  );
}
