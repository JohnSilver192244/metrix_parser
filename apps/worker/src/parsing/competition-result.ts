import type { DiscGolfMetrixSourceRecord } from "../integration/discgolfmetrix";
import {
  readOptionalNumberField,
  readOptionalStringField,
} from "./competition-record";
import { parseResultPlayerFragment } from "./result-player";

function readField(
  record: DiscGolfMetrixSourceRecord,
  fieldNames: readonly string[],
): unknown {
  for (const fieldName of fieldNames) {
    if (fieldName in record) {
      return record[fieldName];
    }
  }

  return undefined;
}

function readOptionalBooleanField(
  record: DiscGolfMetrixSourceRecord,
  fieldNames: readonly string[],
): boolean | undefined {
  const value = readField(record, fieldNames);

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    if (value === 1) {
      return true;
    }

    if (value === 0) {
      return false;
    }

    return undefined;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === "true" || normalized === "yes" || normalized === "y") {
    return true;
  }

  if (normalized === "false" || normalized === "no" || normalized === "n") {
    return false;
  }

  if (normalized === "dnf") {
    return true;
  }

  return undefined;
}

export interface ParsedCompetitionResultFragment {
  playerId: string | undefined;
  className: string | undefined;
  sum: number | undefined;
  diff: number | undefined;
  dnf: boolean;
}

export function parseCompetitionResultFragment(
  record: DiscGolfMetrixSourceRecord,
): ParsedCompetitionResultFragment {
  const playerFragment = parseResultPlayerFragment(record);
  const dnfFromFlag = readOptionalBooleanField(record, [
    "DNF",
    "dnf",
    "DidNotFinish",
    "didNotFinish",
  ]);
  const status = readOptionalStringField(record, [
    "Status",
    "status",
    "ResultStatus",
    "resultStatus",
  ]);
  const dnfFromStatus = status?.trim().toUpperCase() === "DNF";
  const dnf = dnfFromFlag ?? dnfFromStatus;

  return {
    playerId: playerFragment.playerId,
    className: readOptionalStringField(record, [
      "Class",
      "class",
      "ClassName",
      "className",
      "class_name",
      "Division",
      "division",
    ]),
    sum: readOptionalNumberField(record, [
      "Sum",
      "sum",
      "Total",
      "total",
      "Score",
      "score",
      "Result",
      "result",
    ]),
    diff: readOptionalNumberField(record, [
      "Diff",
      "diff",
      "ToPar",
      "toPar",
      "to_par",
    ]),
    dnf,
  };
}
