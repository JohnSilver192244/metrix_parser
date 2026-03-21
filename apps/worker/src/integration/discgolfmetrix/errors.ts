import { createUpdateIssue, type UpdateProcessingIssue } from "@metrix-parser/shared-types";

export type DiscGolfMetrixClientErrorCode =
  | "discgolfmetrix_network_error"
  | "discgolfmetrix_http_error"
  | "discgolfmetrix_parse_error";

export class DiscGolfMetrixClientError extends Error {
  constructor(
    message: string,
    readonly code: DiscGolfMetrixClientErrorCode,
    readonly context?: {
      status?: number;
      sourceUrl?: string;
    },
  ) {
    super(message);
    this.name = "DiscGolfMetrixClientError";
  }
}

export function toDiscGolfMetrixIssue(
  error: unknown,
  recordKey = "discgolfmetrix:competitions-fetch",
): UpdateProcessingIssue {
  if (error instanceof DiscGolfMetrixClientError) {
    return createUpdateIssue({
      code: error.code,
      message: error.message,
      recoverable: true,
      stage:
        error.code === "discgolfmetrix_parse_error"
          ? "validation"
          : "transport",
      recordKey,
    });
  }

  const message = error instanceof Error ? error.message : "Unexpected DiscGolfMetrix integration error";

  return createUpdateIssue({
    code: "discgolfmetrix_network_error",
    message,
    recoverable: true,
    stage: "transport",
    recordKey,
  });
}
