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

function collectProjectedResultEntries(
  collection: unknown,
): DiscGolfMetrixSourceRecord[] {
  if (!Array.isArray(collection)) {
    return [];
  }

  const projectedEntries: DiscGolfMetrixSourceRecord[] = [];

  for (const entry of collection) {
    if (!isSourceRecord(entry)) {
      continue;
    }

    projectedEntries.push(projectRelevantResultRecord(entry));
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
  return collectProjectedResultEntries(results);
}

export function readResultEntries(
  payload: DiscGolfMetrixResultsPayload,
): DiscGolfMetrixSourceRecord[] {
  const documentedEntries = readDocumentedResultEntries(payload);

  if (documentedEntries.length > 0) {
    return documentedEntries;
  }

  for (const key of RESULT_COLLECTION_KEYS) {
    const collection = payload[key];

    const projectedEntries = collectProjectedResultEntries(collection);

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
