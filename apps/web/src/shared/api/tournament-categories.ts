import type {
  ApiEnvelope,
  CreateTournamentCategoryRequest,
  TournamentCategoriesListMeta,
  TournamentCategoriesListResponse,
  TournamentCategory,
  UpdateTournamentCategoryRequest,
} from "@metrix-parser/shared-types";

import { ApiClientError, requestEnvelope } from "./http";

export function listTournamentCategories(): Promise<
  ApiEnvelope<TournamentCategoriesListResponse, TournamentCategoriesListMeta>
> {
  return requestEnvelope<
    TournamentCategoriesListResponse,
    TournamentCategoriesListMeta
  >("/tournament-categories", {
    method: "GET",
  });
}

export function createTournamentCategory(
  payload: CreateTournamentCategoryRequest,
): Promise<TournamentCategory> {
  return requestEnvelope<TournamentCategory>("/tournament-categories", {
    method: "POST",
    body: JSON.stringify(payload),
  }).then((envelope) => envelope.data);
}

export function updateTournamentCategory(
  payload: UpdateTournamentCategoryRequest,
): Promise<TournamentCategory> {
  return requestEnvelope<TournamentCategory>("/tournament-categories", {
    method: "PUT",
    body: JSON.stringify(payload),
  }).then((envelope) => envelope.data);
}

export async function deleteTournamentCategory(categoryId: string): Promise<void> {
  await requestEnvelope<null>("/tournament-categories", {
    method: "DELETE",
    body: JSON.stringify({ categoryId }),
  });
}

export function resolveTournamentCategoriesErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.message;
  }

  return "Не удалось загрузить категории турниров.";
}

export function resolveTournamentCategoriesTotal(
  categories: TournamentCategory[],
  meta?: TournamentCategoriesListMeta,
): number {
  return meta?.count ?? categories.length;
}
