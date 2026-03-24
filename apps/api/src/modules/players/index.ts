import type {
  Player,
  PlayerDbRecord,
  UpdatePlayerRequest,
} from "@metrix-parser/shared-types";

import { readJsonBody, sendSuccess } from "../../lib/http";
import { HttpError } from "../../lib/http-errors";
import type { RouteDefinition } from "../../lib/router";
import { createApiSupabaseAdminClient } from "../../lib/supabase-admin";

const APP_PUBLIC_SCHEMA = "app_public";
const PLAYERS_SELECT_COLUMNS = [
  "player_id",
  "player_name",
  "division",
  "rdga",
].join(", ");

const PLAYERS_SELECT_COLUMNS_LEGACY = [
  "player_id",
  "player_name",
  "division",
].join(", ");

const PLAYER_RESULT_COUNTS_SELECT_COLUMNS = [
  "player_id",
  "competition_id",
].join(", ");

interface PlayerReadAdapter {
  listPlayers(): Promise<PlayerDbRecord[]>;
}

interface PlayerWriteAdapter {
  updatePlayerFields(payload: UpdatePlayerRequest): Promise<PlayerDbRecord>;
}

interface SupabaseQueryError {
  code?: string;
  message: string;
}

export interface PlayersRouteDependencies {
  listPlayers?: () => Promise<Player[]>;
  updatePlayer?: (payload: UpdatePlayerRequest) => Promise<Player>;
}

function toPlayer(record: PlayerDbRecord): Player {
  return {
    playerId: record.player_id,
    playerName: record.player_name,
    division: record.division,
    rdga: record.rdga,
    competitionsCount: record.competitions_count ?? 0,
  };
}

function createSupabasePlayerReadAdapter(): PlayerReadAdapter {
  const supabase = createApiSupabaseAdminClient();

  return {
    async listPlayers() {
      let { data, error } = await supabase
        .schema(APP_PUBLIC_SCHEMA)
        .from("players")
        .select(PLAYERS_SELECT_COLUMNS)
        .order("player_name", { ascending: true });

      if (isMissingRdgaColumnError(error)) {
        const legacyResponse = await supabase
          .schema(APP_PUBLIC_SCHEMA)
          .from("players")
          .select(PLAYERS_SELECT_COLUMNS_LEGACY)
          .order("player_name", { ascending: true });

        data = legacyResponse.data;
        error = legacyResponse.error;
      }

      if (error) {
        throw new Error(`Failed to load players list: ${error.message}`);
      }

      const { data: resultPairs, error: resultPairsError } = await supabase
        .schema(APP_PUBLIC_SCHEMA)
        .from("competition_results")
        .select(PLAYER_RESULT_COUNTS_SELECT_COLUMNS);

      if (resultPairsError) {
        throw new Error(
          `Failed to load player competition counts: ${resultPairsError.message}`,
        );
      }

      const competitionIdsByPlayerId = new Map<string, Set<string>>();

      for (const pair of (resultPairs ?? []) as unknown as Array<{
        player_id: string | null;
        competition_id: string | null;
      }>) {
        const playerId = pair.player_id?.trim();
        const competitionId = pair.competition_id?.trim();

        if (!playerId || !competitionId) {
          continue;
        }

        const competitionIds =
          competitionIdsByPlayerId.get(playerId) ?? new Set<string>();
        competitionIds.add(competitionId);
        competitionIdsByPlayerId.set(playerId, competitionIds);
      }

      return ((data ?? []) as unknown as PlayerDbRecord[]).map((player) => ({
        ...player,
        competitions_count:
          competitionIdsByPlayerId.get(player.player_id)?.size ?? 0,
      }));
    },
  };
}

function createSupabasePlayerWriteAdapter(): PlayerWriteAdapter {
  const supabase = createApiSupabaseAdminClient();

  return {
    async updatePlayerFields(payload) {
      let { data, error } = await supabase
        .schema(APP_PUBLIC_SCHEMA)
        .from("players")
        .update({
          division: payload.division,
          rdga: payload.rdga,
        })
        .eq("player_id", payload.playerId)
        .select(PLAYERS_SELECT_COLUMNS)
        .single();

      if (isMissingRdgaColumnError(error)) {
        const legacyResponse = await supabase
          .schema(APP_PUBLIC_SCHEMA)
          .from("players")
          .update({
            division: payload.division,
          })
          .eq("player_id", payload.playerId)
          .select(PLAYERS_SELECT_COLUMNS_LEGACY)
          .single();

        data = legacyResponse.data
          ? {
              ...legacyResponse.data,
              rdga: null,
            }
          : legacyResponse.data;
        error = legacyResponse.error;
      }

      if (error) {
        throw new Error(`Failed to update player fields: ${error.message}`);
      }

      return data as unknown as PlayerDbRecord;
    },
  };
}

function isMissingRdgaColumnError(error: SupabaseQueryError | null): boolean {
  return error?.code === "42703" && error.message.includes("rdga");
}

function normalizeRdga(value: unknown): boolean | null {
  if (value == null) {
    return null;
  }

  if (typeof value !== "boolean") {
    throw new HttpError(400, "invalid_rdga", "Player RDGA must be a boolean or null");
  }

  return value;
}

async function listPlayersFromRuntime(): Promise<Player[]> {
  const adapter = createSupabasePlayerReadAdapter();
  const records = await adapter.listPlayers();

  return records.map(toPlayer);
}

function normalizeDivision(value: unknown): string | null {
  if (value == null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new HttpError(400, "invalid_division", "Player division must be a string or null");
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function parseUpdatePlayerRequestBody(body: unknown): UpdatePlayerRequest {
  if (!body || typeof body !== "object") {
    throw new HttpError(400, "invalid_payload", "Request body must be a JSON object");
  }

  const playerIdValue = "playerId" in body ? body.playerId : undefined;

  if (typeof playerIdValue !== "string" || playerIdValue.trim().length === 0) {
    throw new HttpError(400, "invalid_player_id", "Player id is required");
  }

  return {
    playerId: playerIdValue.trim(),
    division: normalizeDivision("division" in body ? body.division : null),
    rdga: normalizeRdga("rdga" in body ? body.rdga : null),
  };
}

async function updatePlayerFromRuntime(payload: UpdatePlayerRequest): Promise<Player> {
  const adapter = createSupabasePlayerWriteAdapter();
  const record = await adapter.updatePlayerFields(payload);

  return toPlayer(record);
}

export function getPlayersRoutes(
  dependencies: PlayersRouteDependencies = {},
): RouteDefinition[] {
  return [
    {
      method: "GET",
      path: "/players",
      handler: async ({ res }) => {
        const players = await (dependencies.listPlayers ?? listPlayersFromRuntime)();

        sendSuccess(res, players, {
          count: players.length,
        });
      },
    },
    {
      method: "PUT",
      path: "/players",
      handler: async ({ req, res }) => {
        const body = await readJsonBody<UpdatePlayerRequest>(req);
        const payload = parseUpdatePlayerRequestBody(body);
        const player = await (dependencies.updatePlayer ?? updatePlayerFromRuntime)(
          payload,
        );

        sendSuccess(res, player);
      },
    },
  ];
}
