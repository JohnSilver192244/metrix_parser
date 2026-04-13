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

const PLAYERS_PAGE_LIMIT = 1_000;
const PLAYER_RESULTS_PAGE_LIMIT = 1_000;

function buildPlayersPath(
  filters: ListPlayersFilters = {},
  pagination?: { limit: number; offset: number },
): string {
  const params = new URLSearchParams();

  if (filters.seasonCode) {
    params.set("seasonCode", filters.seasonCode);
  }

  if (pagination) {
    params.set("limit", String(pagination.limit));
    params.set("offset", String(pagination.offset));
  }

  const query = params.toString();
  return query.length > 0 ? `/players?${query}` : "/players";
}

function buildPlayerResultsPath(
  filters: ListPlayerResultsFilters,
  pagination?: { limit: number; offset: number },
): string {
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

  if (pagination) {
    params.set("limit", String(pagination.limit));
    params.set("offset", String(pagination.offset));
  }

  return `/players/results?${params.toString()}`;
}

const PLAYER_CACHE_TTL_MS = 30_000;
const playerCacheById = new Map<string, { value: Player; expiresAt: number }>();

function readPlayerFromCache(playerId: string): Player | null {
  const cached = playerCacheById.get(playerId);
  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= Date.now()) {
    playerCacheById.delete(playerId);
    return null;
  }

  return cached.value;
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
  return loadAllPlayers(filters);
}

export async function getPlayer(playerId: string): Promise<Player> {
  const cachedPlayer = readPlayerFromCache(playerId);
  if (cachedPlayer) {
    return cachedPlayer;
  }

  const envelope = await requestEnvelope<Player>(`/players/${encodeURIComponent(playerId)}`, {
    method: "GET",
  });
  playerCacheById.set(playerId, {
    value: envelope.data,
    expiresAt: Date.now() + PLAYER_CACHE_TTL_MS,
  });

  return envelope.data;
}

export function updatePlayer(payload: UpdatePlayerRequest): Promise<Player> {
  return requestEnvelope<Player>("/players", {
    method: "PUT",
    body: JSON.stringify(payload),
  }).then((envelope) => {
    playerCacheById.set(envelope.data.playerId, {
      value: envelope.data,
      expiresAt: Date.now() + PLAYER_CACHE_TTL_MS,
    });
    return envelope.data;
  });
}

export function listPlayerResults(
  filters: ListPlayerResultsFilters,
): Promise<ApiEnvelope<PlayerResultsListResponse, PlayerResultsListMeta>> {
  return loadAllPlayerResults(filters);
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

async function loadAllPlayers(
  filters: ListPlayersFilters,
): Promise<ApiEnvelope<PlayersListResponse, PlayersListMeta>> {
  const players: Player[] = [];
  let offset = 0;

  while (true) {
    const envelope = await requestEnvelope<PlayersListResponse, PlayersListMeta>(
      buildPlayersPath(filters, {
        limit: PLAYERS_PAGE_LIMIT,
        offset,
      }),
      {
        method: "GET",
      },
    );
    players.push(...envelope.data);

    if (envelope.data.length < PLAYERS_PAGE_LIMIT) {
      break;
    }

    offset += PLAYERS_PAGE_LIMIT;
  }

  return {
    data: players,
    meta: {
      count: players.length,
      limit: players.length,
      offset: 0,
    },
  };
}

async function loadAllPlayerResults(
  filters: ListPlayerResultsFilters,
): Promise<ApiEnvelope<PlayerResultsListResponse, PlayerResultsListMeta>> {
  const results: PlayerCompetitionResult[] = [];
  let offset = 0;

  while (true) {
    const envelope = await requestEnvelope<PlayerResultsListResponse, PlayerResultsListMeta>(
      buildPlayerResultsPath(filters, {
        limit: PLAYER_RESULTS_PAGE_LIMIT,
        offset,
      }),
      {
        method: "GET",
      },
    );
    results.push(...envelope.data);

    if (envelope.data.length < PLAYER_RESULTS_PAGE_LIMIT) {
      break;
    }

    offset += PLAYER_RESULTS_PAGE_LIMIT;
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
