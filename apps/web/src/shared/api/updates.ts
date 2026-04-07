import type {
  TriggerUpdateResponse,
  TriggerUpdateRequestBody,
  UpdateOperationResult,
  UpdateOperation,
  UpdatePeriod,
} from "@metrix-parser/shared-types";

import { ApiClientError, requestJson } from "./http";

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
    issues: [],
    skipReasons: [],
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
