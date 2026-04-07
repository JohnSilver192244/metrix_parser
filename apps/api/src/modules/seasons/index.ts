import type {
  Season,
  SeasonDbRecord,
} from "@metrix-parser/shared-types";

import { sendError, sendSuccess } from "../../lib/http";
import type { RouteDefinition } from "../../lib/router";
import { createApiSupabaseAdminClient } from "../../lib/supabase-admin";

const APP_PUBLIC_SCHEMA = "app_public";
const SEASONS_SELECT_COLUMNS = [
  "season_code",
  "name",
  "date_from",
  "date_to",
  "best_leagues_count",
  "best_tournaments_count",
  "min_players",
  "created_at",
  "updated_at",
].join(", ");

interface SeasonReadAdapter {
  listSeasons(): Promise<SeasonDbRecord[]>;
}

export interface SeasonsRouteDependencies {
  listSeasons?: () => Promise<Season[]>;
}

function toSeason(record: SeasonDbRecord): Season {
  return {
    seasonCode: record.season_code,
    name: record.name,
    dateFrom: record.date_from,
    dateTo: record.date_to,
    bestLeaguesCount: record.best_leagues_count,
    bestTournamentsCount: record.best_tournaments_count,
    minPlayers: record.min_players,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

function createSupabaseSeasonReadAdapter(): SeasonReadAdapter {
  const supabase = createApiSupabaseAdminClient();

  return {
    async listSeasons() {
      const { data, error } = await supabase
        .schema(APP_PUBLIC_SCHEMA)
        .from("seasons")
        .select(SEASONS_SELECT_COLUMNS)
        .order("date_from", { ascending: false })
        .order("season_code", { ascending: false });

      if (error) {
        throw new Error(`Failed to load seasons list: ${error.message}`);
      }

      return (data ?? []) as unknown as SeasonDbRecord[];
    },
  };
}

async function listSeasonsFromRuntime(): Promise<Season[]> {
  const adapter = createSupabaseSeasonReadAdapter();
  const records = await adapter.listSeasons();

  return records.map(toSeason);
}

export function getSeasonsRoutes(
  dependencies: SeasonsRouteDependencies = {},
): RouteDefinition[] {
  return [
    {
      method: "POST",
      path: "/seasons",
      handler: ({ res }) => {
        sendError(
          res,
          {
            code: "seasons_read_only",
            message: "Seasons are managed via database migrations only",
          },
          405,
        );
      },
    },
    {
      method: "PUT",
      path: "/seasons",
      handler: ({ res }) => {
        sendError(
          res,
          {
            code: "seasons_read_only",
            message: "Seasons are managed via database migrations only",
          },
          405,
        );
      },
    },
    {
      method: "DELETE",
      path: "/seasons",
      handler: ({ res }) => {
        sendError(
          res,
          {
            code: "seasons_read_only",
            message: "Seasons are managed via database migrations only",
          },
          405,
        );
      },
    },
    {
      method: "GET",
      path: "/seasons",
      handler: async ({ res }) => {
        const seasons = await (dependencies.listSeasons ?? listSeasonsFromRuntime)();

        sendSuccess(res, seasons, {
          count: seasons.length,
        });
      },
    },
  ];
}
