export type UpdateOperation = "competitions" | "courses" | "players" | "results";
export type UpdateLifecyclePhase = "idle" | "submitting" | "success" | "error";
export type UpdateFinalStatus = "completed" | "completed_with_issues" | "failed";
export type UpdateResultSource = "stub" | "runtime";
export type UpdateRecordAction = "created" | "updated" | "skipped";
export type UpdateEntityIdentity = "competition" | "course" | "player" | "result";
export type UpdateIdempotencyStrategy = "single-field" | "fallback-fields" | "composite-key";
export type UpdateProcessingStage = "transport" | "validation" | "matching" | "persistence";

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
  errors: number;
}

export interface UpdateProcessingIssue {
  code: string;
  message: string;
  recoverable: boolean;
  stage: UpdateProcessingStage;
  recordKey?: string;
}

export interface UpdateRecordResult {
  action: UpdateRecordAction;
  matchedExisting: boolean;
  issue?: UpdateProcessingIssue;
}

export interface UpdateIdentityRule {
  entity: UpdateEntityIdentity;
  strategy: UpdateIdempotencyStrategy;
  matchFields: readonly string[];
  description: string;
}

export interface UpdateOperationResult {
  operation: UpdateOperation;
  finalStatus: UpdateFinalStatus;
  source: UpdateResultSource;
  message: string;
  requestedAt: string;
  finishedAt: string;
  summary?: UpdateSummary;
  issues: UpdateProcessingIssue[];
  period?: UpdatePeriod;
}

export type TriggerUpdateResponse = UpdateOperationResult;

export const UPDATE_IDENTITY_RULES: Record<UpdateEntityIdentity, UpdateIdentityRule> = {
  competition: {
    entity: "competition",
    strategy: "fallback-fields",
    matchFields: ["competition_id", "metrix_id"],
    description:
      "Competitions are matched by competition_id first, with metrix_id as a compatible fallback during repeated imports.",
  },
  course: {
    entity: "course",
    strategy: "single-field",
    matchFields: ["course_id"],
    description:
      "Courses should reuse a stable course_id from the source system before creating a new persistent row.",
  },
  player: {
    entity: "player",
    strategy: "single-field",
    matchFields: ["player_id"],
    description:
      "Players are idempotently matched by the source player_id across repeated ingestions.",
  },
  result: {
    entity: "result",
    strategy: "composite-key",
    matchFields: ["competition_id", "player_id", "round_number"],
    description:
      "Results use a composite source key so reruns update the same competitive outcome instead of inserting duplicates.",
  },
};

export function createEmptyUpdateSummary(): UpdateSummary {
  return {
    found: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
  };
}

export function resolveRecordAction(matchedExisting: boolean): Extract<UpdateRecordAction, "created" | "updated"> {
  return matchedExisting ? "updated" : "created";
}

export function accumulateUpdateSummary(
  current: UpdateSummary,
  record: UpdateRecordResult,
): UpdateSummary {
  return {
    found: current.found + 1,
    created: current.created + (record.action === "created" ? 1 : 0),
    updated: current.updated + (record.action === "updated" ? 1 : 0),
    skipped: current.skipped + (record.action === "skipped" ? 1 : 0),
    errors: current.errors + (record.issue ? 1 : 0),
  };
}

export function resolveUpdateFinalStatus(summary: UpdateSummary): UpdateFinalStatus {
  const successfulRecords = summary.created + summary.updated;

  if (successfulRecords === 0 && summary.errors > 0) {
    return "failed";
  }

  if (summary.errors > 0 || summary.skipped > 0) {
    return "completed_with_issues";
  }

  return "completed";
}

export function createUpdateIssue(
  issue: UpdateProcessingIssue,
): UpdateProcessingIssue {
  return issue;
}
