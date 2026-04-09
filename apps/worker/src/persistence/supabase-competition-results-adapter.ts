import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  CompetitionResultRow,
  CompetitionResultsPersistenceAdapter,
  StoredCompetitionResultRecord,
} from "./competition-results-repository";

const COMPETITION_RESULTS_SELECT_COLUMNS =
  "id, competition_id, player_id, class_name, sum, diff, dnf, raw_payload, source_fetched_at";
const COMPETITION_RESULTS_LOOKUP_SELECT_COLUMNS =
  "id, competition_id, player_id";
const APP_PUBLIC_SCHEMA = "app_public";

export function createSupabaseCompetitionResultsAdapter(
  supabase: SupabaseClient,
): CompetitionResultsPersistenceAdapter {
  return {
    async findByIdentity(competitionId, playerId) {
      const { data, error } = await supabase
        .schema(APP_PUBLIC_SCHEMA)
        .from("competition_results")
        .select(COMPETITION_RESULTS_SELECT_COLUMNS)
        .eq("competition_id", competitionId)
        .eq("player_id", playerId)
        .maybeSingle();

      if (error) {
        throw new Error(
          `Failed to load competition result by composite identity: ${error.message}`,
        );
      }

      return data as CompetitionResultRow | null;
    },

    async findByCompetitionIds(competitionIds) {
      if (competitionIds.length === 0) {
        return [];
      }

      const { data, error } = await supabase
        .schema(APP_PUBLIC_SCHEMA)
        .from("competition_results")
        .select(COMPETITION_RESULTS_LOOKUP_SELECT_COLUMNS)
        .in("competition_id", competitionIds);

      if (error) {
        throw new Error(
          `Failed to load competition results by competition_id: ${error.message}`,
        );
      }

      return (data ?? []) as CompetitionResultRow[];
    },

    async insert(record: StoredCompetitionResultRecord) {
      const { data, error } = await supabase
        .schema(APP_PUBLIC_SCHEMA)
        .from("competition_results")
        .insert(record)
        .select(COMPETITION_RESULTS_SELECT_COLUMNS)
        .single();

      if (error) {
        throw new Error(`Failed to insert competition result: ${error.message}`);
      }

      return data as CompetitionResultRow;
    },

    async update(id, record: StoredCompetitionResultRecord) {
      const { data, error } = await supabase
        .schema(APP_PUBLIC_SCHEMA)
        .from("competition_results")
        .update(record)
        .eq("id", id)
        .select(COMPETITION_RESULTS_SELECT_COLUMNS)
        .single();

      if (error) {
        throw new Error(`Failed to update competition result ${id}: ${error.message}`);
      }

      return data as CompetitionResultRow;
    },

    async upsert(records) {
      if (records.length === 0) {
        return [];
      }

      const { data, error } = await supabase
        .schema(APP_PUBLIC_SCHEMA)
        .from("competition_results")
        .upsert(records, {
          onConflict: "competition_id,player_id",
        })
        .select(COMPETITION_RESULTS_SELECT_COLUMNS);

      if (error) {
        throw new Error(`Failed to upsert competition results: ${error.message}`);
      }

      return (data ?? []) as CompetitionResultRow[];
    },
  };
}
