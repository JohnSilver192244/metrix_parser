import type {
  ApiEnvelope,
  Season,
  SeasonsListMeta,
  SeasonsListResponse,
} from "@metrix-parser/shared-types";

import { ApiClientError, requestEnvelope } from "./http";

export function listSeasons(): Promise<
  ApiEnvelope<SeasonsListResponse, SeasonsListMeta>
> {
  return requestEnvelope<SeasonsListResponse, SeasonsListMeta>("/seasons", {
    method: "GET",
  });
}

export function resolveSeasonsErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.message;
  }

  return "Не удалось загрузить конфигурацию сезонов.";
}

export function resolveSeasonsTotal(
  seasons: Season[],
  meta?: SeasonsListMeta,
): number {
  return meta?.count ?? seasons.length;
}
