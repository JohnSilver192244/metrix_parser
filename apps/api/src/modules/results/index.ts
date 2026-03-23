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
  "class_name",
  "sum",
  "diff",
  "order_number",
  "dnf",
].join(", ");

interface ResultReadAdapter {
  listResults(): Promise<CompetitionResultDbRecord[]>;
}

export interface ResultsRouteDependencies {
  listResults?: () => Promise<CompetitionResult[]>;
}

function toCompetitionResult(
  record: CompetitionResultDbRecord,
): CompetitionResult {
  return {
    competitionId: record.competition_id,
    playerId: record.player_id,
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
    async listResults() {
      const { data, error } = await supabase
        .schema(APP_PUBLIC_SCHEMA)
        .from("competition_results")
        .select(RESULTS_SELECT_COLUMNS)
        .order("competition_id", { ascending: false })
        .order("order_number", { ascending: true });

      if (error) {
        throw new Error(`Failed to load results list: ${error.message}`);
      }

      return (data ?? []) as unknown as CompetitionResultDbRecord[];
    },
  };
}

async function listResultsFromRuntime(): Promise<CompetitionResult[]> {
  const adapter = createSupabaseResultReadAdapter();
  const records = await adapter.listResults();

  return records.map(toCompetitionResult);
}

export function getResultsRoutes(
  dependencies: ResultsRouteDependencies = {},
): RouteDefinition[] {
  return [
    {
      method: "GET",
      path: "/results",
      handler: async ({ res }) => {
        const results = await (dependencies.listResults ?? listResultsFromRuntime)();

        sendSuccess(res, results, {
          count: results.length,
        });
      },
    },
  ];
}
