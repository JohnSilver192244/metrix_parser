import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  PlayerRow,
  PlayersPersistenceAdapter,
  StoredPlayerRecord,
} from "./players-repository";

const PLAYERS_SELECT_COLUMNS =
  "id, player_id, player_name, division, rdga, rdga_since, season_division, raw_payload, source_fetched_at";
const PLAYERS_LOOKUP_SELECT_COLUMNS =
  "id, player_id, division, rdga, rdga_since, season_division";
const APP_PUBLIC_SCHEMA = "app_public";

export function createSupabasePlayersAdapter(
  supabase: SupabaseClient,
): PlayersPersistenceAdapter {
  return {
    async findByPlayerId(playerId) {
      const { data, error } = await supabase
        .schema(APP_PUBLIC_SCHEMA)
        .from("players")
        .select(PLAYERS_SELECT_COLUMNS)
        .eq("player_id", playerId)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to load player by player_id: ${error.message}`);
      }

      return data as PlayerRow | null;
    },

    async findByPlayerIds(playerIds) {
      if (playerIds.length === 0) {
        return [];
      }

      const { data, error } = await supabase
        .schema(APP_PUBLIC_SCHEMA)
        .from("players")
        .select(PLAYERS_LOOKUP_SELECT_COLUMNS)
        .in("player_id", playerIds);

      if (error) {
        throw new Error(`Failed to load players by player_id: ${error.message}`);
      }

      return (data ?? []) as PlayerRow[];
    },

    async insert(record: StoredPlayerRecord) {
      const { data, error } = await supabase
        .schema(APP_PUBLIC_SCHEMA)
        .from("players")
        .insert(record)
        .select(PLAYERS_SELECT_COLUMNS)
        .single();

      if (error) {
        throw new Error(`Failed to insert player: ${error.message}`);
      }

      return data as PlayerRow;
    },

    async update(id, record) {
      const { data, error } = await supabase
        .schema(APP_PUBLIC_SCHEMA)
        .from("players")
        .update(record)
        .eq("id", id)
        .select(PLAYERS_SELECT_COLUMNS)
        .single();

      if (error) {
        throw new Error(`Failed to update player ${id}: ${error.message}`);
      }

      return data as PlayerRow;
    },

    async upsert(records) {
      if (records.length === 0) {
        return [];
      }

      const { data, error } = await supabase
        .schema(APP_PUBLIC_SCHEMA)
        .from("players")
        .upsert(records, {
          onConflict: "player_id",
        })
        .select(PLAYERS_SELECT_COLUMNS);

      if (error) {
        throw new Error(`Failed to upsert players: ${error.message}`);
      }

      return (data ?? []) as PlayerRow[];
    },
  };
}
