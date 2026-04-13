import type {
  ApiEnvelope,
  Competition,
  CompetitionContextResponse,
  CompetitionsListMeta,
  CompetitionsListResponse,
  UpdateCompetitionCategoryApiRequest,
  UpdateCompetitionCategoryResponse,
} from "@metrix-parser/shared-types";

import { ApiClientError, requestEnvelope } from "./http";

const COMPETITION_CONTEXT_CACHE_TTL_MS = 30_000;
const COMPETITIONS_PAGE_LIMIT = 1_000;
const competitionContextCacheById = new Map<
  string,
  { value: CompetitionContextResponse; expiresAt: number }
>();

function readCompetitionContextFromCache(
  competitionId: string,
): CompetitionContextResponse | null {
  const cached = competitionContextCacheById.get(competitionId);
  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= Date.now()) {
    competitionContextCacheById.delete(competitionId);
    return null;
  }

  return cached.value;
}

export function listCompetitions(): Promise<
  ApiEnvelope<CompetitionsListResponse, CompetitionsListMeta>
> {
  return loadAllCompetitions();
}

export function listCompetitionsPage(params: {
  limit: number;
  offset: number;
}): Promise<ApiEnvelope<CompetitionsListResponse, CompetitionsListMeta>> {
  const searchParams = new URLSearchParams();
  searchParams.set("limit", String(params.limit));
  searchParams.set("offset", String(params.offset));

  return requestEnvelope<CompetitionsListResponse, CompetitionsListMeta>(
    `/competitions?${searchParams.toString()}`,
    {
      method: "GET",
    },
  );
}

export async function getCompetitionContext(
  competitionId: string,
): Promise<CompetitionContextResponse> {
  const cached = readCompetitionContextFromCache(competitionId);
  if (cached) {
    return cached;
  }

  const envelope = await requestEnvelope<CompetitionContextResponse>(
    `/competitions/${encodeURIComponent(competitionId)}/context`,
    {
      method: "GET",
    },
  );
  competitionContextCacheById.set(competitionId, {
    value: envelope.data,
    expiresAt: Date.now() + COMPETITION_CONTEXT_CACHE_TTL_MS,
  });

  return envelope.data;
}

export function updateCompetitionCategory(
  payload: UpdateCompetitionCategoryApiRequest,
): Promise<Competition> {
  return requestEnvelope<UpdateCompetitionCategoryResponse>("/competitions/category", {
    method: "PUT",
    body: JSON.stringify(payload),
  }).then((envelope) => {
    // Category updates can affect context payloads for multiple hierarchy nodes.
    competitionContextCacheById.clear();
    return envelope.data;
  });
}

export function resolveCompetitionsErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.message;
  }

  return "Не удалось загрузить список соревнований.";
}

export function resolveCompetitionsTotal(
  competitions: Competition[],
  meta?: CompetitionsListMeta,
): number {
  return meta?.count ?? competitions.length;
}

async function loadAllCompetitions(): Promise<
  ApiEnvelope<CompetitionsListResponse, CompetitionsListMeta>
> {
  const competitions: Competition[] = [];
  let offset = 0;

  while (true) {
    const params = new URLSearchParams();
    params.set("limit", String(COMPETITIONS_PAGE_LIMIT));
    params.set("offset", String(offset));

    const envelope = await requestEnvelope<CompetitionsListResponse, CompetitionsListMeta>(
      `/competitions?${params.toString()}`,
      {
        method: "GET",
      },
    );
    competitions.push(...envelope.data);

    if (envelope.data.length < COMPETITIONS_PAGE_LIMIT) {
      break;
    }

    offset += COMPETITIONS_PAGE_LIMIT;
  }

  return {
    data: competitions,
    meta: {
      count: competitions.length,
      limit: competitions.length,
      offset: 0,
    },
  };
}
