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
}

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

  for (const item of plan.items) {
    try {
      const recordResult = await plan.processItem(item);
      const normalizedRecord =
        recordResult.issue && recordResult.action !== "skipped"
          ? { ...recordResult, action: "skipped" as const }
          : recordResult;

      summary = accumulateUpdateSummary(summary, normalizedRecord);

      if (normalizedRecord.issue) {
        issues.push(normalizedRecord.issue);
      }
    } catch (error) {
      const issue = toRecoverableIssue(error, item.recordKey);

      summary = accumulateUpdateSummary(summary, {
        action: "skipped",
        matchedExisting: false,
        issue,
      });
      issues.push(issue);
    }
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
    period: plan.period,
  };
}
