import {
  accumulateUpdateSummary,
  createEmptyUpdateSummary,
  createUpdateIssue,
  resolveUpdateFinalStatus,
  type UpdateOperation,
  type UpdateOperationResult,
  type UpdatePeriod,
  type UpdateProcessingIssue,
  type UpdateRecordResult,
  type UpdateResultSource,
} from "@metrix-parser/shared-types";

import { mapWithConcurrency } from "../lib/bounded-concurrency";

export interface UpdateWorkItem<TPayload> {
  recordKey: string;
  payload: TPayload;
}

export interface UpdateExecutionPlan<TPayload> {
  operation: UpdateOperation;
  items: readonly UpdateWorkItem<TPayload>[];
  processItem: (item: UpdateWorkItem<TPayload>) => Promise<UpdateRecordResult> | UpdateRecordResult;
  message: string;
  period?: UpdatePeriod;
  source?: UpdateResultSource;
  requestedAt?: string;
  concurrency?: number;
}

type ProcessedPlanItem =
  | { recordResult: UpdateRecordResult; issue?: never }
  | { issue: UpdateProcessingIssue; recordResult?: never };

function toRecoverableIssue(error: unknown, recordKey: string): UpdateProcessingIssue {
  const message =
    error instanceof Error ? error.message : "Неизвестная ошибка обработки обновления";

  return createUpdateIssue({
    code: "record_processing_failed",
    message,
    recoverable: true,
    stage: "persistence",
    recordKey,
  });
}

export async function executeUpdatePlan<TPayload>(
  plan: UpdateExecutionPlan<TPayload>,
): Promise<UpdateOperationResult> {
  const requestedAt = plan.requestedAt ?? new Date().toISOString();
  let summary = createEmptyUpdateSummary();
  const issues: UpdateProcessingIssue[] = [];
  const skipReasons: UpdateProcessingIssue[] = [];

  const processedItems: ProcessedPlanItem[] = await mapWithConcurrency(
    plan.items,
    plan.concurrency ?? 1,
    async (item): Promise<ProcessedPlanItem> => {
      try {
        const recordResult = await plan.processItem(item);
        const normalizedRecord =
          recordResult.issue && recordResult.action !== "skipped"
            ? { ...recordResult, action: "skipped" as const }
            : recordResult;

        return {
          recordResult: normalizedRecord,
        } as const;
      } catch (error) {
        return {
          issue: toRecoverableIssue(error, item.recordKey),
        } as const;
      }
    },
  );

  for (const processedItem of processedItems) {
    if (processedItem.recordResult) {
      summary = accumulateUpdateSummary(summary, processedItem.recordResult);

      if (processedItem.recordResult.issue) {
        issues.push(processedItem.recordResult.issue);
      }

      if (processedItem.recordResult.skipReason) {
        skipReasons.push(processedItem.recordResult.skipReason);
      }

      continue;
    }

    summary = accumulateUpdateSummary(summary, {
      action: "skipped",
      matchedExisting: false,
      issue: processedItem.issue,
    });
    issues.push(processedItem.issue);
  }

  return {
    operation: plan.operation,
    finalStatus: resolveUpdateFinalStatus(summary),
    source: plan.source ?? "runtime",
    message: plan.message,
    requestedAt,
    finishedAt: new Date().toISOString(),
    summary,
    issues,
    skipReasons,
    period: plan.period,
  };
}
