import type { Player, PlayerDbRecord } from "@metrix-parser/shared-types";

import { sendSuccess } from "../../lib/http";
import type { RouteDefinition } from "../../lib/router";
import { createApiSupabaseAdminClient } from "../../lib/supabase-admin";

const APP_PUBLIC_SCHEMA = "app_public";
const PLAYERS_SELECT_COLUMNS = [
  "player_id",
  "player_name",
].join(", ");

interface PlayerReadAdapter {
  listPlayers(): Promise<PlayerDbRecord[]>;
}

export interface PlayersRouteDependencies {
  listPlayers?: () => Promise<Player[]>;
}

function toPlayer(record: PlayerDbRecord): Player {
  return {
    playerId: record.player_id,
    playerName: record.player_name,
  };
}

function createSupabasePlayerReadAdapter(): PlayerReadAdapter {
  const supabase = createApiSupabaseAdminClient();

  return {
    async listPlayers() {
      const { data, error } = await supabase
        .schema(APP_PUBLIC_SCHEMA)
        .from("players")
        .select(PLAYERS_SELECT_COLUMNS)
        .order("player_name", { ascending: true });

      if (error) {
        throw new Error(`Failed to load players list: ${error.message}`);
      }

      return (data ?? []) as unknown as PlayerDbRecord[];
    },
  };
}

async function listPlayersFromRuntime(): Promise<Player[]> {
  const adapter = createSupabasePlayerReadAdapter();
  const records = await adapter.listPlayers();

  return records.map(toPlayer);
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
  ];
}
