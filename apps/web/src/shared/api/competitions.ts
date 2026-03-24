import type {
  ApiEnvelope,
  Competition,
  CompetitionsListMeta,
  CompetitionsListResponse,
} from "@metrix-parser/shared-types";

import { ApiClientError, requestEnvelope } from "./http";

export function listCompetitions(): Promise<
  ApiEnvelope<CompetitionsListResponse, CompetitionsListMeta>
> {
  return requestEnvelope<CompetitionsListResponse, CompetitionsListMeta>(
    "/competitions",
    {
      method: "GET",
    },
  );
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
