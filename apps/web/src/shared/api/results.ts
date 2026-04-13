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

const RESULTS_CACHE_TTL_MS = 30_000;
const RESULTS_PAGE_LIMIT = 1_000;
const resultsCacheByCompetitionId = new Map<
  string,
  { value: ApiEnvelope<ResultsListResponse, ResultsListMeta>; expiresAt: number }
>();

function buildResultsPath(
  filters: ResultsListFilters,
  pagination?: { limit: number; offset: number },
): string {
  const searchParams = new URLSearchParams();

  if (filters.competitionId) {
    searchParams.set("competitionId", filters.competitionId);
  }

  if (pagination) {
    searchParams.set("limit", String(pagination.limit));
    searchParams.set("offset", String(pagination.offset));
  }

  return searchParams.size > 0 ? `/results?${searchParams.toString()}` : "/results";
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
  const cacheKey = filters.competitionId?.trim() ?? "";
  if (cacheKey.length > 0) {
    const cached = resultsCacheByCompetitionId.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return Promise.resolve(cached.value);
    }

    if (cached && cached.expiresAt <= Date.now()) {
      resultsCacheByCompetitionId.delete(cacheKey);
    }
  }

  return loadAllResults(filters).then((envelope) => {
    if (cacheKey.length > 0) {
      resultsCacheByCompetitionId.set(cacheKey, {
        value: envelope,
        expiresAt: Date.now() + RESULTS_CACHE_TTL_MS,
      });
    }

    return envelope;
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

async function loadAllResults(
  filters: ResultsListFilters,
): Promise<ApiEnvelope<ResultsListResponse, ResultsListMeta>> {
  const results: CompetitionResult[] = [];
  let offset = 0;

  while (true) {
    const envelope = await requestEnvelope<ResultsListResponse, ResultsListMeta>(
      buildResultsPath(filters, {
        limit: RESULTS_PAGE_LIMIT,
        offset,
      }),
      {
        method: "GET",
      },
    );
    results.push(...envelope.data);

    if (envelope.data.length < RESULTS_PAGE_LIMIT) {
      break;
    }

    offset += RESULTS_PAGE_LIMIT;
  }

  return {
    data: results,
    meta: {
      count: results.length,
      limit: results.length,
      offset: 0,
    },
  };
}
