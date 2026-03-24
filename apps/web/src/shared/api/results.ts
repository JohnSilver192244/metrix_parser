import type {
  ApiEnvelope,
  CompetitionResult,
  ResultsListMeta,
  ResultsListResponse,
} from "@metrix-parser/shared-types";

import { ApiClientError, requestEnvelope } from "./http";

export interface ResultsListFilters {
  competitionId?: string;
}

export function listResults(): Promise<
  ApiEnvelope<ResultsListResponse, ResultsListMeta>
>;
export function listResults(
  filters: ResultsListFilters,
): Promise<ApiEnvelope<ResultsListResponse, ResultsListMeta>>;
export function listResults(
  filters: ResultsListFilters = {},
): Promise<ApiEnvelope<ResultsListResponse, ResultsListMeta>> {
  const searchParams = new URLSearchParams();

  if (filters.competitionId) {
    searchParams.set("competitionId", filters.competitionId);
  }

  const path = searchParams.size > 0 ? `/results?${searchParams.toString()}` : "/results";

  return requestEnvelope<ResultsListResponse, ResultsListMeta>(path, {
    method: "GET",
  });
}

export function resolveResultsErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.message;
  }

  return "Не удалось загрузить результаты соревнований.";
}

export function resolveResultsTotal(
  results: CompetitionResult[],
  meta?: ResultsListMeta,
): number {
  return meta?.count ?? results.length;
}
