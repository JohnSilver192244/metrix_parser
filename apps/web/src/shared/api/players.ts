import type {
  ApiEnvelope,
  Player,
  PlayerCompetitionResult,
  PlayerResultsListMeta,
  PlayerResultsListResponse,
  PlayersListMeta,
  PlayersListResponse,
  UpdatePlayerRequest,
} from "@metrix-parser/shared-types";

import { ApiClientError, requestEnvelope } from "./http";

export interface ListPlayersFilters {
  seasonCode?: string;
}

export interface ListPlayerResultsFilters {
  playerId: string;
  seasonCode?: string;
  dateFrom?: string;
  dateTo?: string;
}

function buildPlayersPath(filters: ListPlayersFilters = {}): string {
  const params = new URLSearchParams();

  if (filters.seasonCode) {
    params.set("seasonCode", filters.seasonCode);
  }

  const query = params.toString();
  return query.length > 0 ? `/players?${query}` : "/players";
}

function buildPlayerResultsPath(filters: ListPlayerResultsFilters): string {
  const params = new URLSearchParams();

  params.set("playerId", filters.playerId);

  if (filters.seasonCode) {
    params.set("seasonCode", filters.seasonCode);
  }

  if (filters.dateFrom) {
    params.set("dateFrom", filters.dateFrom);
  }

  if (filters.dateTo) {
    params.set("dateTo", filters.dateTo);
  }

  return `/players/results?${params.toString()}`;
}

export function listPlayers(): Promise<
  ApiEnvelope<PlayersListResponse, PlayersListMeta>
>;
export function listPlayers(
  filters: ListPlayersFilters,
): Promise<ApiEnvelope<PlayersListResponse, PlayersListMeta>>;
export function listPlayers(
  filters: ListPlayersFilters = {},
): Promise<ApiEnvelope<PlayersListResponse, PlayersListMeta>> {
  return requestEnvelope<PlayersListResponse, PlayersListMeta>(
    buildPlayersPath(filters),
    {
    method: "GET",
    },
  );
}

export function updatePlayer(payload: UpdatePlayerRequest): Promise<Player> {
  return requestEnvelope<Player>("/players", {
    method: "PUT",
    body: JSON.stringify(payload),
  }).then((envelope) => envelope.data);
}

export function listPlayerResults(
  filters: ListPlayerResultsFilters,
): Promise<ApiEnvelope<PlayerResultsListResponse, PlayerResultsListMeta>> {
  return requestEnvelope<PlayerResultsListResponse, PlayerResultsListMeta>(
    buildPlayerResultsPath(filters),
    {
      method: "GET",
    },
  );
}

export function resolvePlayersErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.message;
  }

  return "Не удалось загрузить список игроков.";
}

export function resolvePlayersTotal(
  players: Player[],
  meta?: PlayersListMeta,
): number {
  return meta?.count ?? players.length;
}

export function resolvePlayerResultsTotal(
  results: PlayerCompetitionResult[],
  meta?: PlayerResultsListMeta,
): number {
  return meta?.count ?? results.length;
}
