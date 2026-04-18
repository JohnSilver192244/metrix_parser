import type {
  CompetitionHierarchyNode,
  CompetitionResult,
  CompetitionResultDbRecord,
} from "@metrix-parser/shared-types";
import {
  buildCompetitionChildrenByParentId,
  resolveCompetitionIdentityById,
} from "@metrix-parser/shared-types";

import { sendSuccess } from "../../lib/http";
import { HttpError } from "../../lib/http-errors";
import type { RouteDefinition } from "../../lib/router";
import { createApiSupabaseAdminClient } from "../../lib/supabase-admin";
import {
  createSupabaseCompetitionHierarchyLoader,
  loadCompetitionHierarchyContext,
  type CompetitionHierarchyRow,
} from "../competition-hierarchy";

const APP_PUBLIC_SCHEMA = "app_public";
const DEFAULT_RESULTS_LIMIT = 200;
const MAX_RESULTS_LIMIT = 1000;
const RESULTS_SELECT_COLUMNS = [
  "competition_id",
  "player_id",
  "competition:competitions!competition_results_competition_id_fkey(competition_name)",
  "player:players!competition_results_player_id_fkey(player_name, rdga)",
  "class_name",
  "sum",
  "diff",
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
  "dnf",
].join(", ");

export interface ResultsListFilters {
  competitionId?: string;
  playerId?: string;
  className?: string;
  dnf?: boolean;
  limit: number;
  offset: number;
}

interface ResultReadAdapter {
  listResults(filters: ResultsListFilters): Promise<CompetitionResultDbRecord[]>;
}

interface SupabaseQueryError {
  code?: string;
  message: string;
}

interface SupabaseCompetitionRelation {
  competition_name?: string | null;
  competition_date?: string | null;
}

interface SupabasePlayerRelation {
  player_name?: string | null;
  rdga?: boolean | null;
}

interface SupabaseCompetitionResultRow extends CompetitionResultDbRecord {
  competition?: SupabaseCompetitionRelation | null;
  player?: SupabasePlayerRelation | null;
}

interface SeasonStandingPointsRow {
  competition_id: string;
  player_id: string;
  season_code: string | null;
  season_points: number | string | null;
}

export interface ResultsRouteDependencies {
  listResults?: (filters: ResultsListFilters) => Promise<CompetitionResult[]>;
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
    dnf: record.dnf,
    seasonPoints: record.season_points ?? null,
  };
}

function normalizePaginationNumber(
  rawValue: string | null,
  fallbackValue: number,
  fieldName: "limit" | "offset",
): number {
  if (rawValue == null || rawValue.trim().length === 0) {
    return fallbackValue;
  }

  if (!/^\d+$/.test(rawValue.trim())) {
    throw new HttpError(400, "invalid_pagination", `${fieldName} must be a non-negative integer`);
  }

  return Number(rawValue);
}

export function resolveSeasonPointsCompetitionIdForResult(
  competitionId: string,
  competitionsById: ReadonlyMap<string, CompetitionHierarchyRow>,
): string {
  const ownerCompetitionIdByCompetitionId =
    buildOwnerCompetitionIdByCompetitionId(competitionsById);

  return ownerCompetitionIdByCompetitionId.get(competitionId) ?? competitionId;
}

function buildOwnerCompetitionIdByCompetitionId(
  competitionsById: ReadonlyMap<string, CompetitionHierarchyRow>,
): Map<string, string> {
  const hierarchyNodes = [...competitionsById.values()].map(
    (competition) =>
      ({
        competitionId: competition.competition_id,
        parentId: competition.parent_id,
        recordType: competition.record_type,
      }) satisfies CompetitionHierarchyNode,
  );
  const hierarchyCompetitionsById = new Map(
    hierarchyNodes.map((competition) => [competition.competitionId, competition]),
  );
  const childrenByParentId = buildCompetitionChildrenByParentId(hierarchyNodes);

  return new Map(
    hierarchyNodes.map((node) => [
      node.competitionId,
      resolveCompetitionIdentityById(
        node.competitionId,
        hierarchyCompetitionsById,
        childrenByParentId,
      ).ownerCompetitionId,
    ]),
  );
}

async function loadCompetitionHierarchy(
  competitionIds: readonly string[],
): Promise<Map<string, CompetitionHierarchyRow>> {
  const supabase = createApiSupabaseAdminClient();
  return loadCompetitionHierarchyContext(
    competitionIds,
    createSupabaseCompetitionHierarchyLoader(supabase, "results list"),
  );
}

export function resolveCanonicalSeasonCodeByCompetition(
  rows: readonly SeasonStandingPointsRow[],
): Map<string, string> {
  const rowsByCompetitionAndSeason = new Map<string, number>();
  const playersByCompetitionAndSeason = new Map<string, Set<string>>();

  for (const row of rows) {
    const competitionId = row.competition_id?.trim() ?? "";
    const seasonCode = row.season_code?.trim() ?? "";
    if (competitionId.length === 0 || seasonCode.length === 0) {
      continue;
    }

    const key = `${competitionId}::${seasonCode}`;
    rowsByCompetitionAndSeason.set(key, (rowsByCompetitionAndSeason.get(key) ?? 0) + 1);

    const playerId = row.player_id?.trim() ?? "";
    if (playerId.length > 0) {
      const players = playersByCompetitionAndSeason.get(key) ?? new Set<string>();
      players.add(playerId);
      playersByCompetitionAndSeason.set(key, players);
    }
  }

  const canonicalSeasonByCompetitionId = new Map<
    string,
    { seasonCode: string; playersCount: number; rowsCount: number }
  >();

  for (const [key, rowsCount] of rowsByCompetitionAndSeason.entries()) {
    const [competitionId, seasonCode = ""] = key.split("::");
    if (!competitionId) {
      continue;
    }

    const playersCount = playersByCompetitionAndSeason.get(key)?.size ?? 0;
    const current = canonicalSeasonByCompetitionId.get(competitionId);
    if (
      !current ||
      playersCount > current.playersCount ||
      (playersCount === current.playersCount && rowsCount > current.rowsCount) ||
      (playersCount === current.playersCount &&
        rowsCount === current.rowsCount &&
        seasonCode.localeCompare(current.seasonCode, "ru") > 0)
    ) {
      canonicalSeasonByCompetitionId.set(competitionId, {
        seasonCode,
        playersCount,
        rowsCount,
      });
    }
  }

  return new Map(
    [...canonicalSeasonByCompetitionId.entries()].map(([competitionId, value]) => [
      competitionId,
      value.seasonCode,
    ]),
  );
}

export function resolveSeasonPointsByResultIdentity(
  resultRows: ReadonlyArray<{ competition_id: string; player_id: string }>,
  competitionsById: ReadonlyMap<string, CompetitionHierarchyRow>,
  seasonStandingRows: readonly SeasonStandingPointsRow[],
): Map<string, number> {
  const ownerCompetitionIdByCompetitionId =
    buildOwnerCompetitionIdByCompetitionId(competitionsById);
  const seasonPointsBySeasonCompetitionPlayer = new Map<string, number>();
  for (const row of seasonStandingRows) {
    const competitionId = row.competition_id?.trim() ?? "";
    const playerId = row.player_id?.trim() ?? "";
    const seasonCode = row.season_code?.trim() ?? "";
    const seasonPoints = Number(row.season_points);

    if (
      competitionId.length === 0 ||
      playerId.length === 0 ||
      seasonCode.length === 0 ||
      !Number.isFinite(seasonPoints)
    ) {
      continue;
    }

    seasonPointsBySeasonCompetitionPlayer.set(
      `${seasonCode}:${competitionId}:${playerId}`,
      seasonPoints,
    );
  }

  const canonicalSeasonCodeByCompetitionId = resolveCanonicalSeasonCodeByCompetition(
    seasonStandingRows,
  );
  const seasonPointsByResultIdentity = new Map<string, number>();
  for (const row of resultRows) {
    const ownerCompetitionId =
      ownerCompetitionIdByCompetitionId.get(row.competition_id) ?? row.competition_id;
    const seasonCode = canonicalSeasonCodeByCompetitionId.get(ownerCompetitionId);
    if (!seasonCode) {
      continue;
    }

    const seasonPoints = seasonPointsBySeasonCompetitionPlayer.get(
      `${seasonCode}:${ownerCompetitionId}:${row.player_id}`,
    );
    if (seasonPoints == null) {
      continue;
    }

    seasonPointsByResultIdentity.set(`${row.competition_id}:${row.player_id}`, seasonPoints);
  }

  return seasonPointsByResultIdentity;
}

function createSupabaseResultReadAdapter(): ResultReadAdapter {
  const supabase = createApiSupabaseAdminClient();

  return {
    async listResults(filters) {
      let query = supabase
        .schema(APP_PUBLIC_SCHEMA)
        .from("competition_results")
        .select(RESULTS_SELECT_COLUMNS)
        .order("competition_id", { ascending: false })
        .order("dnf", { ascending: true })
        .order("sum", { ascending: true, nullsFirst: false })
        .order("diff", { ascending: true, nullsFirst: false })
        .order("player_id", { ascending: true });

      if (filters.competitionId) {
        query = query.eq("competition_id", filters.competitionId);
      }
      if (filters.playerId) {
        query = query.eq("player_id", filters.playerId);
      }
      if (filters.className) {
        query = query.eq("class_name", filters.className);
      }
      if (typeof filters.dnf === "boolean") {
        query = query.eq("dnf", filters.dnf);
      }

      query = query.range(filters.offset, filters.offset + filters.limit - 1);

      let { data, error } = await query;

      if (isMissingRdgaColumnError(error)) {
        let legacyQuery = supabase
          .schema(APP_PUBLIC_SCHEMA)
          .from("competition_results")
          .select(RESULTS_SELECT_COLUMNS_LEGACY)
          .order("competition_id", { ascending: false })
          .order("dnf", { ascending: true })
          .order("sum", { ascending: true, nullsFirst: false })
          .order("diff", { ascending: true, nullsFirst: false })
          .order("player_id", { ascending: true });

        if (filters.competitionId) {
          legacyQuery = legacyQuery.eq("competition_id", filters.competitionId);
        }
        if (filters.playerId) {
          legacyQuery = legacyQuery.eq("player_id", filters.playerId);
        }
        if (filters.className) {
          legacyQuery = legacyQuery.eq("class_name", filters.className);
        }
        if (typeof filters.dnf === "boolean") {
          legacyQuery = legacyQuery.eq("dnf", filters.dnf);
        }

        legacyQuery = legacyQuery.range(filters.offset, filters.offset + filters.limit - 1);

        const legacyResponse = await legacyQuery;
        data = legacyResponse.data;
        error = legacyResponse.error;
      }

      if (error) {
        throw new Error(`Failed to load results list: ${error.message}`);
      }

      const rows = ((data ?? []) as unknown as SupabaseCompetitionResultRow[]).map(
        (row) => ({ ...row }),
      );
      const competitionIds = [...new Set(
        rows
          .map((row) => row.competition_id?.trim() ?? "")
          .filter((competitionId) => competitionId.length > 0),
      )];

      if (competitionIds.length === 0) {
        return rows;
      }

      const competitionsById = await loadCompetitionHierarchy(competitionIds);
      const ownerCompetitionIdByCompetitionId =
        buildOwnerCompetitionIdByCompetitionId(competitionsById);
      const seasonPointsCompetitionIds = [
        ...new Set(
          competitionIds.map(
            (competitionId) =>
              ownerCompetitionIdByCompetitionId.get(competitionId) ?? competitionId,
          ),
        ),
      ];

      const { data: seasonStandingData, error: seasonStandingError } = await supabase
        .schema(APP_PUBLIC_SCHEMA)
        .from("season_standings")
        .select("competition_id, player_id, season_code, season_points")
        .in("competition_id", seasonPointsCompetitionIds);

      if (seasonStandingError) {
        throw new Error(
          `Failed to load season standings for results list: ${seasonStandingError.message}`,
        );
      }

      const seasonPointsByResultIdentity = resolveSeasonPointsByResultIdentity(
        rows,
        competitionsById,
        (seasonStandingData ?? []) as SeasonStandingPointsRow[],
      );

      return rows.map((row) => ({
        ...row,
        season_points:
          seasonPointsByResultIdentity.get(`${row.competition_id}:${row.player_id}`) ?? null,
      }));
    },
  };
}

function isMissingRdgaColumnError(error: SupabaseQueryError | null): boolean {
  return error?.code === "42703" && error.message.includes("rdga");
}

function resolveResultsListFilters(url: URL): ResultsListFilters {
  const competitionId = url.searchParams.get("competitionId")?.trim();
  const playerId = url.searchParams.get("playerId")?.trim();
  const className = url.searchParams.get("className")?.trim();
  const dnfParam = url.searchParams.get("dnf")?.trim().toLowerCase();
  let dnf: boolean | undefined;
  if (dnfParam === "true") {
    dnf = true;
  } else if (dnfParam === "false") {
    dnf = false;
  } else if (dnfParam != null && dnfParam.length > 0) {
    throw new HttpError(400, "invalid_filter", "dnf must be true or false");
  }

  const rawLimit = normalizePaginationNumber(
    url.searchParams.get("limit"),
    DEFAULT_RESULTS_LIMIT,
    "limit",
  );
  const rawOffset = normalizePaginationNumber(url.searchParams.get("offset"), 0, "offset");
  const limit = Math.min(rawLimit, MAX_RESULTS_LIMIT);
  const offset = rawOffset;

  return {
    competitionId: competitionId || undefined,
    playerId: playerId || undefined,
    className: className || undefined,
    dnf,
    limit,
    offset,
  };
}

async function listResultsFromRuntime(
  filters: ResultsListFilters,
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
          limit: filters.limit,
          offset: filters.offset,
        });
      },
    },
  ];
}
