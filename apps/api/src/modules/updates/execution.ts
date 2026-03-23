import {
  UPDATE_IDENTITY_RULES,
  accumulateUpdateSummary,
  createEmptyUpdateSummary,
  createUpdateIssue,
  resolveRecordAction,
  resolveUpdateFinalStatus,
  type TriggerUpdateResponse,
  type UpdateOperation,
  type UpdatePeriod,
  type UpdateProcessingIssue,
  type UpdateRecordResult,
} from "@metrix-parser/shared-types";

import { executeCompetitionsUpdate as executeWorkerCompetitionsUpdate } from "../../../../worker/src/orchestration/competitions-update";
import { executeCoursesUpdate as executeWorkerCoursesUpdate } from "../../../../worker/src/orchestration/courses-update";
import { executePlayersUpdate as executeWorkerPlayersUpdate } from "../../../../worker/src/orchestration/players-update";
import { executeResultsUpdate as executeWorkerResultsUpdate } from "../../../../worker/src/orchestration/results-update";

interface DemoRecord {
  recordKey: string;
  matchedExisting: boolean;
  invalid?: boolean;
}

const DEMO_RECORDS_BY_OPERATION: Record<UpdateOperation, DemoRecord[]> = {
  competitions: [
    { recordKey: "competition-101", matchedExisting: false },
    { recordKey: "competition-102", matchedExisting: true },
    { recordKey: "competition-103", matchedExisting: true },
    { recordKey: "competition-104", matchedExisting: false },
    { recordKey: "competition-bad", matchedExisting: false, invalid: true },
  ],
  courses: [
    { recordKey: "course-201", matchedExisting: false },
    { recordKey: "course-202", matchedExisting: true },
    { recordKey: "course-bad", matchedExisting: false, invalid: true },
  ],
  players: [
    { recordKey: "player-301", matchedExisting: false },
    { recordKey: "player-302", matchedExisting: true },
    { recordKey: "player-303", matchedExisting: false },
    { recordKey: "player-bad", matchedExisting: false, invalid: true },
  ],
  results: [
    { recordKey: "result-401", matchedExisting: false },
    { recordKey: "result-402", matchedExisting: true },
    { recordKey: "result-403", matchedExisting: true },
    { recordKey: "result-bad", matchedExisting: false, invalid: true },
  ],
};

function createDemoRecordResult(record: DemoRecord): UpdateRecordResult {
  if (record.invalid) {
    return {
      action: "skipped",
      matchedExisting: false,
      issue: createUpdateIssue({
        code: "incomplete_source_record",
        message: `Record ${record.recordKey} is incomplete and was skipped.`,
        recoverable: true,
        stage: "validation",
        recordKey: record.recordKey,
      }),
    };
  }

  return {
    action: resolveRecordAction(record.matchedExisting),
    matchedExisting: record.matchedExisting,
  };
}

function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function loadCompetitionsExecutionEnv() {
  return {
    discGolfMetrixBaseUrl: process.env.DISCGOLFMETRIX_BASE_URL ?? "https://discgolfmetrix.com",
    discGolfMetrixCountryCode: requireEnv("DISCGOLFMETRIX_COUNTRY_CODE"),
    discGolfMetrixApiCode: requireEnv("DISCGOLFMETRIX_API_CODE"),
  };
}

export interface UpdatesExecutionDependencies {
  executeCompetitionsUpdate?: (
    period: UpdatePeriod,
  ) => Promise<TriggerUpdateResponse>;
  executeCoursesUpdate?: () => Promise<TriggerUpdateResponse>;
  executePlayersUpdate?: (
    period: UpdatePeriod,
  ) => Promise<TriggerUpdateResponse>;
  executeResultsUpdate?: (
    period: UpdatePeriod,
  ) => Promise<TriggerUpdateResponse>;
}

async function executeRuntimeCompetitionsUpdate(
  period: UpdatePeriod,
): Promise<TriggerUpdateResponse> {
  return executeWorkerCompetitionsUpdate(period, loadCompetitionsExecutionEnv());
}

async function executeRuntimeCoursesUpdate(): Promise<TriggerUpdateResponse> {
  return executeWorkerCoursesUpdate(loadCompetitionsExecutionEnv());
}

async function executeRuntimePlayersUpdate(
  period: UpdatePeriod,
): Promise<TriggerUpdateResponse> {
  return executeWorkerPlayersUpdate(period, loadCompetitionsExecutionEnv());
}

async function executeRuntimeResultsUpdate(
  period: UpdatePeriod,
): Promise<TriggerUpdateResponse> {
  return executeWorkerResultsUpdate(period, loadCompetitionsExecutionEnv());
}

export function createAcceptedResponse(
  operation: UpdateOperation,
  period?: UpdatePeriod,
): TriggerUpdateResponse {
  const requestedAt = new Date().toISOString();
  const issues: UpdateProcessingIssue[] = [];
  let summary = createEmptyUpdateSummary();

  for (const record of DEMO_RECORDS_BY_OPERATION[operation]) {
    const recordResult = createDemoRecordResult(record);

    summary = accumulateUpdateSummary(summary, recordResult);

    if (recordResult.issue) {
      issues.push(recordResult.issue);
    }
  }

  const identityRule =
    operation === "competitions"
      ? UPDATE_IDENTITY_RULES.competition
      : operation === "courses"
        ? UPDATE_IDENTITY_RULES.course
        : operation === "players"
          ? UPDATE_IDENTITY_RULES.player
          : UPDATE_IDENTITY_RULES.result;

  return {
    operation,
    finalStatus: resolveUpdateFinalStatus(summary),
    source: "stub",
    message: `Сценарий ${operation} использует contract-first stub с per-record aggregation и правилом идемпотентности по ${identityRule.matchFields.join(", ")}.`,
    requestedAt,
    finishedAt: requestedAt,
    summary,
    issues,
    period,
  };
}

export async function executeUpdateOperation(
  operation: UpdateOperation,
  period: UpdatePeriod | undefined,
  dependencies: UpdatesExecutionDependencies = {},
): Promise<TriggerUpdateResponse> {
  if (operation === "competitions") {
    const executeCompetitionsUpdate =
      dependencies.executeCompetitionsUpdate ?? executeRuntimeCompetitionsUpdate;

    return executeCompetitionsUpdate(period as UpdatePeriod);
  }

  if (operation === "courses") {
    const executeCoursesUpdate =
      dependencies.executeCoursesUpdate ?? executeRuntimeCoursesUpdate;

    return executeCoursesUpdate();
  }

  if (operation === "players") {
    const executePlayersUpdate =
      dependencies.executePlayersUpdate ?? executeRuntimePlayersUpdate;

    return executePlayersUpdate(period as UpdatePeriod);
  }

  if (operation === "results") {
    const executeResultsUpdate =
      dependencies.executeResultsUpdate ?? executeRuntimeResultsUpdate;

    return executeResultsUpdate(period as UpdatePeriod);
  }

  return createAcceptedResponse(operation, period);
}
