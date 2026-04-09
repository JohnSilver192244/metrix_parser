import type {
  ApiEnvelope,
  CreateDivisionRequest,
  DeleteDivisionApiRequest,
  Division,
  UpdateDivisionRequest,
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

export function createDivision(payload: CreateDivisionRequest): Promise<Division> {
  return requestEnvelope<Division>("/divisions", {
    method: "POST",
    body: JSON.stringify(payload),
  }).then((envelope) => envelope.data);
}

export function updateDivision(payload: UpdateDivisionRequest): Promise<Division> {
  return requestEnvelope<Division>("/divisions", {
    method: "PUT",
    body: JSON.stringify(payload),
  }).then((envelope) => envelope.data);
}

export async function deleteDivision(code: string): Promise<void> {
  const payload: DeleteDivisionApiRequest = { code };

  await requestEnvelope<null>("/divisions", {
    method: "DELETE",
    body: JSON.stringify(payload),
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
