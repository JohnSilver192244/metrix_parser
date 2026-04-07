import type {
  ApiEnvelope,
  CreateSeasonPointsEntryRequest,
  SeasonPointsEntry,
  SeasonPointsTableListMeta,
  SeasonPointsTableListResponse,
  UpdateSeasonPointsEntryRequest,
} from "@metrix-parser/shared-types";

import { ApiClientError, requestEnvelope } from "./http";

export interface SeasonPointsTableListFilters {
  seasonCode?: string;
  playersCount?: number;
}

function buildSeasonPointsTablePath(
  filters: SeasonPointsTableListFilters = {},
): string {
  const params = new URLSearchParams();

  if (filters.seasonCode) {
    params.set("seasonCode", filters.seasonCode);
  }

  if (typeof filters.playersCount === "number") {
    params.set("playersCount", String(filters.playersCount));
  }

  const query = params.toString();
  return query.length > 0 ? `/season-points-table?${query}` : "/season-points-table";
}

export function listSeasonPointsTable(
  filters: SeasonPointsTableListFilters = {},
): Promise<ApiEnvelope<SeasonPointsTableListResponse, SeasonPointsTableListMeta>> {
  return requestEnvelope<
    SeasonPointsTableListResponse,
    SeasonPointsTableListMeta
  >(buildSeasonPointsTablePath(filters), {
    method: "GET",
  });
}

export function createSeasonPointsEntry(
  payload: CreateSeasonPointsEntryRequest,
): Promise<SeasonPointsEntry> {
  return requestEnvelope<SeasonPointsEntry>("/season-points-table", {
    method: "POST",
    body: JSON.stringify(payload),
  }).then((envelope) => envelope.data);
}

export function updateSeasonPointsEntry(
  payload: UpdateSeasonPointsEntryRequest,
): Promise<SeasonPointsEntry> {
  return requestEnvelope<SeasonPointsEntry>("/season-points-table", {
    method: "PUT",
    body: JSON.stringify(payload),
  }).then((envelope) => envelope.data);
}

export async function deleteSeasonPointsEntry(payload: {
  seasonCode: string;
  playersCount: number;
  placement: number;
}): Promise<void> {
  await requestEnvelope<null>("/season-points-table", {
    method: "DELETE",
    body: JSON.stringify(payload),
  });
}

export function resolveSeasonPointsTableErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.message;
  }

  return "Не удалось загрузить таблицу сезонных очков.";
}

export function resolveSeasonPointsTableTotal(
  entries: SeasonPointsEntry[],
  meta?: SeasonPointsTableListMeta,
): number {
  return meta?.count ?? entries.length;
}
