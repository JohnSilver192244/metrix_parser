import type {
  ApiEnvelope,
  Division,
  DivisionsListMeta,
  DivisionsListResponse,
} from "@metrix-parser/shared-types";

import { ApiClientError, requestEnvelope } from "./http";

export function listDivisions(): Promise<
  ApiEnvelope<DivisionsListResponse, DivisionsListMeta>
> {
  return requestEnvelope<DivisionsListResponse, DivisionsListMeta>("/divisions", {
    method: "GET",
  });
}

export function resolveDivisionsErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.message;
  }

  return "Не удалось загрузить справочник дивизионов.";
}

export function resolveDivisionsTotal(
  divisions: Division[],
  meta?: DivisionsListMeta,
): number {
  return meta?.count ?? divisions.length;
}
