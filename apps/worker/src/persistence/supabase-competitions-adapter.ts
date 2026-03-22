import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  CompetitionRow,
  CompetitionsPersistenceAdapter,
  StoredCompetitionRecord,
} from "./competitions-repository";

const COMPETITIONS_SELECT_COLUMNS =
  "id, competition_id, competition_name, competition_date, course_name, record_type, players_count, metrix_id, raw_payload, source_fetched_at";
const APP_PUBLIC_SCHEMA = "app_public";

export function createSupabaseCompetitionsAdapter(
  supabase: SupabaseClient,
): CompetitionsPersistenceAdapter {
  return {
    async findByCompetitionId(competitionId) {
      const { data, error } = await supabase
        .schema(APP_PUBLIC_SCHEMA)
        .from("competitions")
        .select(COMPETITIONS_SELECT_COLUMNS)
        .eq("competition_id", competitionId)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to load competition by competition_id: ${error.message}`);
      }

      return data as CompetitionRow | null;
    },

    async findByMetrixId(metrixId) {
      const { data, error } = await supabase
        .schema(APP_PUBLIC_SCHEMA)
        .from("competitions")
        .select(COMPETITIONS_SELECT_COLUMNS)
        .eq("metrix_id", metrixId)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to load competition by metrix_id: ${error.message}`);
      }

      return data as CompetitionRow | null;
    },

    async insert(record: StoredCompetitionRecord) {
      const { data, error } = await supabase
        .schema(APP_PUBLIC_SCHEMA)
        .from("competitions")
        .insert(record)
        .select(COMPETITIONS_SELECT_COLUMNS)
        .single();

      if (error) {
        throw new Error(`Failed to insert competition: ${error.message}`);
      }

      return data as CompetitionRow;
    },

    async update(id, record: StoredCompetitionRecord) {
      const { data, error } = await supabase
        .schema(APP_PUBLIC_SCHEMA)
        .from("competitions")
        .update(record)
        .eq("id", id)
        .select(COMPETITIONS_SELECT_COLUMNS)
        .single();

      if (error) {
        throw new Error(`Failed to update competition ${id}: ${error.message}`);
      }

      return data as CompetitionRow;
    },
  };
}
