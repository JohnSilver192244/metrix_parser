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
import type { RouteDefinition } from "../../lib/router";
import { createApiSupabaseAdminClient } from "../../lib/supabase-admin";

const APP_PUBLIC_SCHEMA = "app_public";
const RESULTS_SELECT_COLUMNS = [
  "competition_id",
  "player_id",
  "competition:competitions!competition_results_competition_id_fkey(competition_name, competition_date)",
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
  "competition:competitions!competition_results_competition_id_fkey(competition_name, competition_date)",
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

interface CompetitionHierarchyRow {
  competition_id: string;
  parent_id: string | null;
  record_type: string | null;
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
    seasonPoints: record.season_points ?? null,
  };
}

export function resolveSeasonPointsCompetitionIdForResult(
  competitionId: string,
  competitionsById: ReadonlyMap<string, CompetitionHierarchyRow>,
): string {
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

  return resolveCompetitionIdentityById(
    competitionId,
    hierarchyCompetitionsById,
    childrenByParentId,
  ).ownerCompetitionId;
}

async function loadCompetitionHierarchy(
  competitionIds: readonly string[],
): Promise<Map<string, CompetitionHierarchyRow>> {
  if (competitionIds.length === 0) {
    return new Map();
  }

  const supabase = createApiSupabaseAdminClient();
  const competitionsById = new Map<string, CompetitionHierarchyRow>();
  let pendingCompetitionIds = [...new Set(competitionIds)];

  while (pendingCompetitionIds.length > 0) {
    const { data, error } = await supabase
      .schema(APP_PUBLIC_SCHEMA)
      .from("competitions")
      .select("competition_id, parent_id, record_type")
      .in("competition_id", pendingCompetitionIds);

    if (error) {
      throw new Error(`Failed to load competition hierarchy for results list: ${error.message}`);
    }

    const fetchedRows = (data ?? []) as CompetitionHierarchyRow[];
    for (const row of fetchedRows) {
      competitionsById.set(row.competition_id, row);
    }

    const parentIdsToLoad = fetchedRows
      .map((row) => row.parent_id?.trim() ?? "")
      .filter((parentId) => parentId.length > 0)
      .filter((parentId) => !competitionsById.has(parentId));

    pendingCompetitionIds = [...new Set(parentIdsToLoad)];
  }

  return competitionsById;
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
    const ownerCompetitionId = resolveSeasonPointsCompetitionIdForResult(
      row.competition_id,
      competitionsById,
    );
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
      const seasonPointsCompetitionIds = [
        ...new Set(
          competitionIds.map((competitionId) =>
            resolveSeasonPointsCompetitionIdForResult(competitionId, competitionsById),
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
