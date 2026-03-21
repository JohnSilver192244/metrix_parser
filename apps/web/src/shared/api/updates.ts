import type {
  TriggerUpdateResponse,
  TriggerUpdateRequestBody,
  UpdateOperationResult,
  UpdateOperation,
  UpdatePeriod,
  UpdateSummary,
} from "@metrix-parser/shared-types";

import { ApiClientError, requestJson } from "./http";

const EMPTY_SUMMARY: UpdateSummary = {
  found: 0,
  created: 0,
  updated: 0,
  skipped: 0,
};

export function triggerUpdate(
  operation: UpdateOperation,
  body: TriggerUpdateRequestBody,
): Promise<UpdateOperationResult> {
  return requestJson<TriggerUpdateResponse>(`/updates/${operation}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function createFailedUpdateResult(
  operation: UpdateOperation,
  message: string,
  period?: UpdatePeriod,
): UpdateOperationResult {
  const timestamp = new Date().toISOString();

  return {
    operation,
    finalStatus: "failed",
    source: "runtime",
    message,
    requestedAt: timestamp,
    finishedAt: timestamp,
    period,
  };
}

export function mapUpdateError(
  operation: UpdateOperation,
  error: unknown,
  period?: UpdatePeriod,
): UpdateOperationResult {
  if (error instanceof ApiClientError) {
    return createFailedUpdateResult(operation, error.message, period);
  }

  return createFailedUpdateResult(operation, "Не удалось завершить операцию обновления.", period);
}
