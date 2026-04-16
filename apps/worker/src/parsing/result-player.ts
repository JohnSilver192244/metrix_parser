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

function readTrackEntries(payload: DiscGolfMetrixResultsPayload): unknown[] {
  const competition = payload.Competition;

  if (isSourceRecord(competition) && Array.isArray(competition.Tracks)) {
    return competition.Tracks;
  }

  if (Array.isArray(payload.Tracks)) {
    return payload.Tracks;
  }

  return [];
}

function readPlayerResultsCollection(
  record: DiscGolfMetrixSourceRecord,
): unknown[] | null {
  const candidates = [
    record.PlayerResults,
    record.playerResults,
    record.player_results,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  return null;
}

function hasNonEmptyHoleResult(entry: unknown): boolean {
  if (!isSourceRecord(entry)) {
    return false;
  }

  const result = entry.Result ?? entry.result ?? entry.Score ?? entry.score;

  if (typeof result === "number") {
    return Number.isFinite(result);
  }

  if (typeof result === "string") {
    return result.trim().length > 0;
  }

  return false;
}

function inferIncompleteRoundDnf(
  record: DiscGolfMetrixSourceRecord,
  expectedTrackCount: number,
): boolean {
  if (expectedTrackCount <= 0) {
    return false;
  }

  const playerResults = readPlayerResultsCollection(record);

  if (!playerResults) {
    return false;
  }

  if (playerResults.length < expectedTrackCount) {
    return true;
  }

  return playerResults.slice(0, expectedTrackCount).some((entry) => !hasNonEmptyHoleResult(entry));
}

function projectRelevantResultRecord(
  record: DiscGolfMetrixSourceRecord,
  options: { inferredDnf?: boolean } = {},
): DiscGolfMetrixSourceRecord {
  const projected: DiscGolfMetrixSourceRecord = {};

  for (const key of RELEVANT_RESULT_RECORD_FIELDS) {
    if (key in record) {
      projected[key] = record[key];
    }
  }

  if (options.inferredDnf) {
    projected.DNF = true;
  }

  return projected;
}

function collectProjectedResultEntries(
  collection: unknown,
  options: { expectedTrackCount?: number } = {},
): DiscGolfMetrixSourceRecord[] {
  if (!Array.isArray(collection)) {
    return [];
  }

  const projectedEntries: DiscGolfMetrixSourceRecord[] = [];

  for (const entry of collection) {
    if (!isSourceRecord(entry)) {
      continue;
    }

    projectedEntries.push(
      projectRelevantResultRecord(entry, {
        inferredDnf: inferIncompleteRoundDnf(entry, options.expectedTrackCount ?? 0),
      }),
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
  return collectProjectedResultEntries(results, {
    expectedTrackCount: readTrackEntries(payload).length,
  });
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

    const projectedEntries = collectProjectedResultEntries(collection, {
      expectedTrackCount: readTrackEntries(payload).length,
    });

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
