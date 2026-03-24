import type {
  Competition,
  CompetitionDbRecord,
} from "@metrix-parser/shared-types";

import { sendSuccess } from "../../lib/http";
import { createApiSupabaseAdminClient } from "../../lib/supabase-admin";
import type { RouteDefinition } from "../../lib/router";

const APP_PUBLIC_SCHEMA = "app_public";
const COMPETITIONS_SELECT_COLUMNS = [
  "competition_id",
  "competition_name",
  "competition_date",
  "parent_id",
  "course_id",
  "course_name",
  "record_type",
  "players_count",
  "metrix_id",
].join(", ");

interface CompetitionReadAdapter {
  listCompetitions(): Promise<CompetitionDbRecord[]>;
}

export interface CompetitionsRouteDependencies {
  listCompetitions?: () => Promise<Competition[]>;
}

function toCompetition(record: CompetitionDbRecord): Competition {
  return {
    competitionId: record.competition_id,
    competitionName: record.competition_name,
    competitionDate: record.competition_date,
    parentId: record.parent_id ?? null,
    courseId: record.course_id,
    courseName: record.course_name,
    recordType: record.record_type,
    playersCount: record.players_count,
    metrixId: record.metrix_id,
  };
}

function createSupabaseCompetitionReadAdapter(): CompetitionReadAdapter {
  const supabase = createApiSupabaseAdminClient();

  return {
    async listCompetitions() {
      const { data, error } = await supabase
        .schema(APP_PUBLIC_SCHEMA)
        .from("competitions")
        .select(COMPETITIONS_SELECT_COLUMNS)
        .order("competition_date", { ascending: false })
        .order("competition_name", { ascending: true });

      if (error) {
        throw new Error(`Failed to load competitions list: ${error.message}`);
      }

      return (data ?? []) as unknown as CompetitionDbRecord[];
    },
  };
}

async function listCompetitionsFromRuntime(): Promise<Competition[]> {
  const adapter = createSupabaseCompetitionReadAdapter();
  const records = await adapter.listCompetitions();

  return records.map(toCompetition);
}

export function getCompetitionsRoutes(
  dependencies: CompetitionsRouteDependencies = {},
): RouteDefinition[] {
  return [
    {
      method: "GET",
      path: "/competitions",
      handler: async ({ res }) => {
        const competitions =
          await (dependencies.listCompetitions ?? listCompetitionsFromRuntime)();

        sendSuccess(res, competitions, {
          count: competitions.length,
        });
      },
    },
  ];
}
