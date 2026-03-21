import { DiscGolfMetrixClientError } from "./errors";
import type {
  DiscGolfMetrixCompetitionsPayload,
  DiscGolfMetrixRawCompetitionRecord,
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
