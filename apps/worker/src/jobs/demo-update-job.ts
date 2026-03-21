import {
  createUpdateIssue,
  resolveRecordAction,
  type UpdateOperation,
  type UpdatePeriod,
  type UpdateRecordResult,
} from "@metrix-parser/shared-types";

import { executeUpdatePlan, type UpdateWorkItem } from "../orchestration/update-execution";

interface DemoRecordPayload {
  matchedExisting: boolean;
  invalid?: boolean;
}

const DEMO_ITEMS_BY_OPERATION: Record<UpdateOperation, UpdateWorkItem<DemoRecordPayload>[]> = {
  competitions: [
    { recordKey: "competition-101", payload: { matchedExisting: false } },
    { recordKey: "competition-102", payload: { matchedExisting: true } },
    { recordKey: "competition-103", payload: { matchedExisting: true } },
    { recordKey: "competition-104", payload: { matchedExisting: false } },
    { recordKey: "competition-bad", payload: { matchedExisting: false, invalid: true } },
  ],
  courses: [
    { recordKey: "course-201", payload: { matchedExisting: false } },
    { recordKey: "course-202", payload: { matchedExisting: true } },
    { recordKey: "course-bad", payload: { matchedExisting: false, invalid: true } },
  ],
  players: [
    { recordKey: "player-301", payload: { matchedExisting: false } },
    { recordKey: "player-302", payload: { matchedExisting: true } },
    { recordKey: "player-303", payload: { matchedExisting: false } },
    { recordKey: "player-bad", payload: { matchedExisting: false, invalid: true } },
  ],
  results: [
    { recordKey: "result-401", payload: { matchedExisting: false } },
    { recordKey: "result-402", payload: { matchedExisting: true } },
    { recordKey: "result-403", payload: { matchedExisting: true } },
    { recordKey: "result-bad", payload: { matchedExisting: false, invalid: true } },
  ],
};

function processDemoItem(
  item: UpdateWorkItem<DemoRecordPayload>,
): UpdateRecordResult {
  if (item.payload.invalid) {
    return {
      action: "skipped",
      matchedExisting: false,
      issue: createUpdateIssue({
        code: "incomplete_source_record",
        message: `Record ${item.recordKey} is incomplete and was skipped.`,
        recoverable: true,
        stage: "validation",
        recordKey: item.recordKey,
      }),
    };
  }

  return {
    action: resolveRecordAction(item.payload.matchedExisting),
    matchedExisting: item.payload.matchedExisting,
  };
}

export async function runDemoUpdateJob(
  operation: UpdateOperation,
  period?: UpdatePeriod,
) {
  return executeUpdatePlan({
    operation,
    items: DEMO_ITEMS_BY_OPERATION[operation],
    period,
    source: "runtime",
    message:
      "Worker demo pipeline aggregated per-record outcomes with idempotent create/update semantics and recoverable skips.",
    processItem: processDemoItem,
  });
}
