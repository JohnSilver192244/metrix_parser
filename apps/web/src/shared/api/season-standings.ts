import type {
  RunSeasonPointsAccrualApiRequest,
  RunSeasonPointsAccrualResponse,
} from "@metrix-parser/shared-types";

import { ApiClientError, requestJson } from "./http";

export function runSeasonPointsAccrual(
  payload: RunSeasonPointsAccrualApiRequest,
): Promise<RunSeasonPointsAccrualResponse> {
  return requestJson<RunSeasonPointsAccrualResponse>("/season-standings/accrual", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function resolveSeasonStandingsErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.message;
  }

  return "Не удалось начислить очки сезона.";
}
