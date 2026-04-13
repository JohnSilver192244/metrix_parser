import type {
  SeasonPointsEntry,
  SeasonPointsEntryDbRecord,
} from "@metrix-parser/shared-types";

import { sendSuccess } from "../../lib/http";
import { HttpError } from "../../lib/http-errors";
import { resolveListPagination } from "../../lib/pagination";
import type { RouteDefinition } from "../../lib/router";
import { createApiSupabaseAdminClient } from "../../lib/supabase-admin";

const APP_PUBLIC_SCHEMA = "app_public";
const SEASON_POINTS_SELECT_COLUMNS = [
  "season_code",
  "players_count",
  "placement",
  "points",
  "created_at",
  "updated_at",
].join(", ");

export interface SeasonPointsTableFilters {
  seasonCode?: string;
  playersCount?: number;
}

interface SeasonPointsTableReadAdapter {
  listSeasonPointsEntries(
    filters?: SeasonPointsTableFilters,
  ): Promise<SeasonPointsEntryDbRecord[]>;
}

export interface SeasonPointsTableRouteDependencies {
  listSeasonPointsEntries?: (
    filters?: SeasonPointsTableFilters,
  ) => Promise<SeasonPointsEntry[]>;
}

function toSeasonPointsEntry(record: SeasonPointsEntryDbRecord): SeasonPointsEntry {
  return {
    seasonCode: record.season_code,
    playersCount: record.players_count,
    placement: record.placement,
    points: record.points,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

function createSupabaseSeasonPointsTableReadAdapter(): SeasonPointsTableReadAdapter {
  const supabase = createApiSupabaseAdminClient();

  return {
    async listSeasonPointsEntries(filters = {}) {
      let query = supabase
        .schema(APP_PUBLIC_SCHEMA)
        .from("season_points_table")
        .select(SEASON_POINTS_SELECT_COLUMNS)
        .order("season_code", { ascending: false })
        .order("players_count", { ascending: true })
        .order("placement", { ascending: true });

      if (filters.seasonCode) {
        query = query.eq("season_code", filters.seasonCode);
      }

      if (typeof filters.playersCount === "number") {
        query = query.eq("players_count", filters.playersCount);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to load season points table: ${error.message}`);
      }

      return (data ?? []) as unknown as SeasonPointsEntryDbRecord[];
    },
  };
}

function normalizeRequiredString(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new HttpError(400, `invalid_${fieldName}`, `${fieldName} must be a string`);
  }

  const normalizedValue = value.trim();
  if (normalizedValue.length === 0) {
    throw new HttpError(400, `invalid_${fieldName}`, `${fieldName} is required`);
  }

  return normalizedValue;
}

function normalizePositiveInteger(value: unknown, fieldName: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new HttpError(
      400,
      `invalid_${fieldName}`,
      `${fieldName} must be a positive integer`,
    );
  }

  return value;
}

function normalizePlayersCount(value: unknown): number {
  const playersCount = normalizePositiveInteger(value, "playersCount");

  if (playersCount < 8) {
    throw new HttpError(
      400,
      "invalid_playersCount",
      "playersCount must be greater than or equal to 8",
    );
  }

  return playersCount;
}

function parsePlayersCountFilter(rawValue: string | null): number | undefined {
  if (rawValue == null || rawValue.trim().length === 0) {
    return undefined;
  }

  const value = Number(rawValue.trim());
  if (!Number.isInteger(value) || value <= 0) {
    throw new HttpError(
      400,
      "invalid_playersCount",
      "playersCount query parameter must be a positive integer",
    );
  }

  return value;
}

function resolveSeasonPointsTableFilters(url: URL): SeasonPointsTableFilters {
  const seasonCode = url.searchParams.get("seasonCode")?.trim();
  const playersCount = parsePlayersCountFilter(url.searchParams.get("playersCount"));

  return {
    seasonCode: seasonCode && seasonCode.length > 0 ? seasonCode : undefined,
    playersCount,
  };
}

async function listSeasonPointsEntriesFromRuntime(
  filters?: SeasonPointsTableFilters,
): Promise<SeasonPointsEntry[]> {
  const adapter = createSupabaseSeasonPointsTableReadAdapter();
  const records = await adapter.listSeasonPointsEntries(filters);

  return records.map(toSeasonPointsEntry);
}

export function getSeasonPointsTableRoutes(
  dependencies: SeasonPointsTableRouteDependencies = {},
): RouteDefinition[] {
  return [
    {
      method: "GET",
      path: "/season-points-table",
      handler: async ({ res, url }) => {
        const pagination = resolveListPagination(url);
        const filters = resolveSeasonPointsTableFilters(url);
        const allEntries = await (
          dependencies.listSeasonPointsEntries ?? listSeasonPointsEntriesFromRuntime
        )(filters);
        const entries = allEntries.slice(
          pagination.offset,
          pagination.offset + pagination.limit,
        );

        sendSuccess(res, entries, {
          count: entries.length,
          limit: pagination.limit,
          offset: pagination.offset,
        });
      },
    },
  ];
}
