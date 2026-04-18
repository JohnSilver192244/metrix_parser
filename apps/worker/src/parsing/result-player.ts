import type {
  DiscGolfMetrixResultsPayload,
  DiscGolfMetrixSourceRecord,
} from "../integration/discgolfmetrix";
import { readOptionalStringField } from "./competition-record";

const RESULT_COLLECTION_KEYS = [
  "results",
  "players",
  "standings",
  "scorecards",
] as const;

const RELEVANT_RESULT_RECORD_FIELDS = [
  "UserID",
  "playerId",
  "player_id",
  "id",
  "memberId",
  "member_id",
  "competitorId",
  "competitor_id",
  "Name",
  "playerName",
  "player_name",
  "name",
  "fullName",
  "full_name",
  "Class",
  "class",
  "ClassName",
  "className",
  "class_name",
  "Division",
  "division",
  "Sum",
  "sum",
  "Total",
  "total",
  "Score",
  "score",
  "Result",
  "result",
  "Place",
  "place",
  "Diff",
  "diff",
  "ToPar",
  "toPar",
  "to_par",
  "DNF",
  "dnf",
  "DidNotFinish",
  "didNotFinish",
  "Status",
  "status",
  "ResultStatus",
  "resultStatus",
] as const;

export interface ParsedResultPlayerFragment {
  playerId: string | undefined;
  playerName: string | undefined;
}

function isSourceRecord(value: unknown): value is DiscGolfMetrixSourceRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function projectRelevantResultRecord(
  record: DiscGolfMetrixSourceRecord,
): DiscGolfMetrixSourceRecord {
  const projected: DiscGolfMetrixSourceRecord = {};

  for (const key of RELEVANT_RESULT_RECORD_FIELDS) {
    if (key in record) {
      projected[key] = record[key];
    }
  }

  return projected;
}

function readOptionalCollection(
  record: DiscGolfMetrixSourceRecord,
  fieldNames: readonly string[],
): unknown[] | undefined {
  for (const fieldName of fieldNames) {
    const value = record[fieldName];
    if (Array.isArray(value)) {
      return value;
    }
  }

  return undefined;
}

function readExpectedTrackCount(payload: DiscGolfMetrixResultsPayload): number | null {
  const competition = isSourceRecord(payload.Competition) ? payload.Competition : null;
  const tracksValue = competition?.Tracks ?? payload.Tracks;

  if (Array.isArray(tracksValue)) {
    return tracksValue.length > 0 ? tracksValue.length : null;
  }

  if (typeof tracksValue === "number" && Number.isInteger(tracksValue) && tracksValue > 0) {
    return tracksValue;
  }

  if (typeof tracksValue === "string") {
    const normalized = tracksValue.trim();
    if (normalized.length === 0) {
      return null;
    }

    const parsed = Number(normalized);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
}

function isCompletedHoleResult(entry: unknown): boolean {
  if (!isSourceRecord(entry)) {
    return false;
  }

  for (const fieldName of ["Result", "result", "Score", "score"] as const) {
    const value = entry[fieldName];

    if (typeof value === "number" && Number.isFinite(value)) {
      return true;
    }

    if (typeof value === "string" && value.trim().length > 0) {
      return true;
    }
  }

  return false;
}

function inferStructuralDnf(
  record: DiscGolfMetrixSourceRecord,
  expectedTrackCount: number | null,
): boolean {
  if (expectedTrackCount === null) {
    return false;
  }

  const playerResults = readOptionalCollection(record, [
    "PlayerResults",
    "playerResults",
    "player_results",
  ]);

  if (!playerResults || playerResults.length < expectedTrackCount) {
    return true;
  }

  return playerResults.slice(0, expectedTrackCount).some((entry) => !isCompletedHoleResult(entry));
}

function collectProjectedResultEntries(
  collection: unknown,
  expectedTrackCount: number | null,
): DiscGolfMetrixSourceRecord[] {
  if (!Array.isArray(collection)) {
    return [];
  }

  const projectedEntries: DiscGolfMetrixSourceRecord[] = [];

  for (const entry of collection) {
    if (!isSourceRecord(entry)) {
      continue;
    }

    const projectedEntry = projectRelevantResultRecord(entry);
    projectedEntries.push(
      inferStructuralDnf(entry, expectedTrackCount)
        ? {
            ...projectedEntry,
            DNF: true,
          }
        : projectedEntry,
    );
  }

  return projectedEntries;
}

function readDocumentedResultEntries(
  payload: DiscGolfMetrixResultsPayload,
): DiscGolfMetrixSourceRecord[] {
  const competition = payload.Competition;

  if (!isSourceRecord(competition)) {
    return [];
  }

  const results = competition.Results;
  return collectProjectedResultEntries(results, readExpectedTrackCount(payload));
}

export function readResultEntries(
  payload: DiscGolfMetrixResultsPayload,
): DiscGolfMetrixSourceRecord[] {
  const documentedEntries = readDocumentedResultEntries(payload);

  if (documentedEntries.length > 0) {
    return documentedEntries;
  }

  const expectedTrackCount = readExpectedTrackCount(payload);

  for (const key of RESULT_COLLECTION_KEYS) {
    const collection = payload[key];

    const projectedEntries = collectProjectedResultEntries(collection, expectedTrackCount);

    if (projectedEntries.length > 0) {
      return projectedEntries;
    }
  }

  return [];
}

export function parseResultPlayerFragment(
  record: DiscGolfMetrixSourceRecord,
): ParsedResultPlayerFragment {
  return {
    playerId: readOptionalStringField(record, [
      "UserID",
      "playerId",
      "player_id",
      "id",
      "memberId",
      "member_id",
      "competitorId",
      "competitor_id",
    ]),
    playerName: readOptionalStringField(record, [
      "Name",
      "playerName",
      "player_name",
      "name",
      "fullName",
      "full_name",
    ]),
  };
}
