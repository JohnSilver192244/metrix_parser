export type UpdateOperation = "competitions" | "courses" | "players" | "results";

export interface UpdatePeriod {
  dateFrom: string;
  dateTo: string;
}

export interface TriggerUpdateRequestBody extends Partial<UpdatePeriod> {}

export interface TriggerUpdateResponse {
  operation: UpdateOperation;
  status: "accepted";
  message: string;
  requestedAt: string;
  period?: UpdatePeriod;
}

export interface UpdateSummary {
  found: number;
  added: number;
  updated: number;
  skipped: number;
}
