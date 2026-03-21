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
