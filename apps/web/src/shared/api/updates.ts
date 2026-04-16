import type {
  TriggerUpdateResponse,
  UpdateJobStatusResponse,
  TriggerUpdateRequestBody,
  UpdateOperationResult,
  UpdateOperation,
  UpdatePeriod,
} from "@metrix-parser/shared-types";
import { isTerminalUpdateJobStatus } from "@metrix-parser/shared-types";

import { ApiClientError, requestJson } from "./http";

export function triggerUpdate(
  operation: UpdateOperation,
  body: TriggerUpdateRequestBody,
): Promise<TriggerUpdateResponse> {
  return requestJson<TriggerUpdateResponse>(`/updates/${operation}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getUpdateJobStatus(jobId: string): Promise<UpdateJobStatusResponse> {
  return requestJson<UpdateJobStatusResponse>(`/updates/jobs/${jobId}`, {
    method: "GET",
  });
}

interface UpdateJobPollingOptions {
  onStatus(status: UpdateJobStatusResponse): void;
  onError(error: unknown): void;
  requestStatus?: (jobId: string) => Promise<UpdateJobStatusResponse>;
  schedule?: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>;
  clear?: (timerId: ReturnType<typeof setTimeout>) => void;
  initialDelayMs?: number;
  pollDelayMs?: number;
}

export function startUpdateJobStatusPolling(
  jobId: string,
  options: UpdateJobPollingOptions,
): () => void {
  const requestStatus = options.requestStatus ?? getUpdateJobStatus;
  const schedule = options.schedule ?? ((callback, delayMs) => setTimeout(callback, delayMs));
  const clear = options.clear ?? clearTimeout;
  const initialDelayMs = options.initialDelayMs ?? 1_000;
  const pollDelayMs = options.pollDelayMs ?? 1_500;
  let cancelled = false;
  let timerId: ReturnType<typeof setTimeout> | null = null;

  async function pollStatus() {
    if (cancelled) {
      return;
    }

    try {
      const status = await requestStatus(jobId);

      if (cancelled) {
        return;
      }

      options.onStatus(status);

      if (!isTerminalUpdateJobStatus(status)) {
        timerId = schedule(() => {
          void pollStatus();
        }, pollDelayMs);
      }
    } catch (error) {
      if (cancelled) {
        return;
      }

      options.onError(error);
    }
  }

  timerId = schedule(() => {
    void pollStatus();
  }, initialDelayMs);

  return () => {
    cancelled = true;
    if (timerId !== null) {
      clear(timerId);
    }
  };
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
