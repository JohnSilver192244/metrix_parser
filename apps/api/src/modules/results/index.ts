import type {
  CompetitionResult,
  CompetitionResultDbRecord,
} from "@metrix-parser/shared-types";

import { sendSuccess } from "../../lib/http";
import type { RouteDefinition } from "../../lib/router";
import { createApiSupabaseAdminClient } from "../../lib/supabase-admin";

const APP_PUBLIC_SCHEMA = "app_public";
const RESULTS_SELECT_COLUMNS = [
  "competition_id",
  "player_id",
  "competition:competitions!competition_results_competition_id_fkey(competition_name)",
  "player:players!competition_results_player_id_fkey(player_name, rdga)",
  "class_name",
  "sum",
  "diff",
  "order_number",
  "dnf",
].join(", ");

const RESULTS_SELECT_COLUMNS_LEGACY = [
  "competition_id",
  "player_id",
  "competition:competitions!competition_results_competition_id_fkey(competition_name)",
  "player:players!competition_results_player_id_fkey(player_name)",
  "class_name",
  "sum",
  "diff",
  "order_number",
  "dnf",
].join(", ");

export interface ResultsListFilters {
  competitionId?: string;
}

interface ResultReadAdapter {
  listResults(filters?: ResultsListFilters): Promise<CompetitionResultDbRecord[]>;
}

interface SupabaseQueryError {
  code?: string;
  message: string;
}

interface SupabaseCompetitionRelation {
  competition_name?: string | null;
}

interface SupabasePlayerRelation {
  player_name?: string | null;
  rdga?: boolean | null;
}

interface SupabaseCompetitionResultRow extends CompetitionResultDbRecord {
  competition?: SupabaseCompetitionRelation | null;
  player?: SupabasePlayerRelation | null;
}

export interface ResultsRouteDependencies {
  listResults?: (filters?: ResultsListFilters) => Promise<CompetitionResult[]>;
}

function toCompetitionResult(
  record: CompetitionResultDbRecord,
): CompetitionResult {
  const row = record as SupabaseCompetitionResultRow;

  return {
    competitionId: record.competition_id,
    playerId: record.player_id,
    competitionName: row.competition?.competition_name ?? record.competition_name ?? null,
    playerName: row.player?.player_name ?? record.player_name ?? null,
    playerRdga: row.player?.rdga ?? record.player_rdga ?? null,
    className: record.class_name,
    sum: record.sum,
    diff: record.diff,
    orderNumber: record.order_number,
    dnf: record.dnf,
  };
}

function createSupabaseResultReadAdapter(): ResultReadAdapter {
  const supabase = createApiSupabaseAdminClient();

  return {
    async listResults(filters = {}) {
      let query = supabase
        .schema(APP_PUBLIC_SCHEMA)
        .from("competition_results")
        .select(RESULTS_SELECT_COLUMNS)
        .order("competition_id", { ascending: false })
        .order("order_number", { ascending: true });

      if (filters.competitionId) {
        query = query.eq("competition_id", filters.competitionId);
      }

      let { data, error } = await query;

      if (isMissingRdgaColumnError(error)) {
        let legacyQuery = supabase
          .schema(APP_PUBLIC_SCHEMA)
          .from("competition_results")
          .select(RESULTS_SELECT_COLUMNS_LEGACY)
          .order("competition_id", { ascending: false })
          .order("order_number", { ascending: true });

        if (filters.competitionId) {
          legacyQuery = legacyQuery.eq("competition_id", filters.competitionId);
        }

        const legacyResponse = await legacyQuery;
        data = legacyResponse.data;
        error = legacyResponse.error;
      }

      if (error) {
        throw new Error(`Failed to load results list: ${error.message}`);
      }

      return (data ?? []) as unknown as SupabaseCompetitionResultRow[];
    },
  };
}

function isMissingRdgaColumnError(error: SupabaseQueryError | null): boolean {
  return error?.code === "42703" && error.message.includes("rdga");
}

function resolveResultsListFilters(url: URL): ResultsListFilters {
  const competitionId = url.searchParams.get("competitionId")?.trim();

  return competitionId ? { competitionId } : {};
}

async function listResultsFromRuntime(
  filters?: ResultsListFilters,
): Promise<CompetitionResult[]> {
  const adapter = createSupabaseResultReadAdapter();
  const records = await adapter.listResults(filters);

  return records.map(toCompetitionResult);
}

export function getResultsRoutes(
  dependencies: ResultsRouteDependencies = {},
): RouteDefinition[] {
  return [
    {
      method: "GET",
      path: "/results",
      handler: async ({ res, url }) => {
        const filters = resolveResultsListFilters(url);
        const results = await (dependencies.listResults ?? listResultsFromRuntime)(filters);

        sendSuccess(res, results, {
          count: results.length,
        });
      },
    },
  ];
}
