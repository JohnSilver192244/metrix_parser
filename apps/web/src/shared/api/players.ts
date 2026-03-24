import type {
  ApiEnvelope,
  Player,
  PlayersListMeta,
  PlayersListResponse,
  UpdatePlayerRequest,
} from "@metrix-parser/shared-types";

import { ApiClientError, requestEnvelope } from "./http";

export function listPlayers(): Promise<
  ApiEnvelope<PlayersListResponse, PlayersListMeta>
> {
  return requestEnvelope<PlayersListResponse, PlayersListMeta>("/players", {
    method: "GET",
  });
}

export function updatePlayer(payload: UpdatePlayerRequest): Promise<Player> {
  return requestEnvelope<Player>("/players", {
    method: "PUT",
    body: JSON.stringify(payload),
  }).then((envelope) => envelope.data);
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
