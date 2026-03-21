export type UpdateOperation = "competitions" | "courses" | "players" | "results";
export type UpdateLifecyclePhase = "idle" | "submitting" | "success" | "error";
export type UpdateFinalStatus = "completed" | "failed";
export type UpdateResultSource = "stub" | "runtime";

export interface UpdatePeriod {
  dateFrom: string;
  dateTo: string;
}

export interface TriggerUpdateRequestBody extends Partial<UpdatePeriod> {}

export interface UpdateSummary {
  found: number;
  created: number;
  updated: number;
  skipped: number;
}

export interface UpdateOperationResult {
  operation: UpdateOperation;
  finalStatus: UpdateFinalStatus;
  source: UpdateResultSource;
  message: string;
  requestedAt: string;
  finishedAt: string;
  summary?: UpdateSummary;
  period?: UpdatePeriod;
}

export type TriggerUpdateResponse = UpdateOperationResult;
