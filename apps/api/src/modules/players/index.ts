import type {
  CompetitionClass,
  CompetitionHierarchyNode,
  Player,
  PlayerSeasonCreditCompetition,
  PlayerCompetitionResult,
  PlayerDbRecord,
  UpdatePlayerRequest,
} from "@metrix-parser/shared-types";
import {
  buildCompetitionChildrenByParentId,
  resolveCompetitionResultSourceIds,
  resolveCompetitionIdentityById,
} from "@metrix-parser/shared-types";

import { readJsonBody, sendSuccess } from "../../lib/http";
import { HttpError } from "../../lib/http-errors";
import { resolveListPagination } from "../../lib/pagination";
import type { RouteDefinition } from "../../lib/router";
import { createApiSupabaseAdminClient } from "../../lib/supabase-admin";
import {
  readSessionToken,
  requireAuthenticatedUser,
  type AuthGuardDependencies,
} from "../auth/runtime";
import {
  createSupabaseCompetitionHierarchyLoader,
  loadCompetitionHierarchyContext,
  type CompetitionHierarchyRow,
} from "../competition-hierarchy";
import { rankCompetitionResultsForSeasonPoints } from "../season-standings";

const APP_PUBLIC_SCHEMA = "app_public";
const DEFAULT_PLAYER_RESULTS_LIMIT = 200;
const MAX_PLAYER_RESULTS_LIMIT = 1000;
const SEASON_STANDINGS_PAGE_SIZE = 1000;
const PLAYERS_SELECT_COLUMNS = [
  "player_id",
  "player_name",
  "division",
  "rdga",
  "rdga_since",
  "season_division",
].join(", ");

const PLAYERS_SELECT_COLUMNS_LEGACY = [
  "player_id",
  "player_name",
  "division",
].join(", ");

const SEASON_STANDINGS_SELECT_COLUMNS = [
  "player_id",
  "competition_id",
  "category_id",
  "placement",
  "season_points",
].join(", ");

const PLAYER_COMPETITION_RESULTS_SELECT_COLUMNS = [
  "competition_id",
  "sum",
  "dnf",
].join(", ");

const PLAYER_COMPETITIONS_SELECT_COLUMNS = [
  "competition_id",
  "competition_name",
  "competition_date",
  "category_id",
  "parent_id",
  "record_type",
].join(", ");

const TOURNAMENT_CATEGORIES_NAME_SELECT_COLUMNS = [
  "category_id",
  "name",
].join(", ");

const TOURNAMENT_CATEGORIES_CLASS_SELECT_COLUMNS = [
  "category_id",
  "competition_class",
].join(", ");

const SEASONS_SELECT_COLUMNS = [
  "season_code",
  "best_leagues_count",
  "best_tournaments_count",
].join(", ");

export interface PlayersListFilters {
  seasonCode?: string;
}

interface PlayerReadAdapter {
  listPlayers(filters?: PlayersListFilters): Promise<PlayerDbRecord[]>;
  getPlayerById(playerId: string): Promise<PlayerDbRecord | null>;
  listPlayerResults(filters: PlayerResultsFilters): Promise<PlayerCompetitionResult[]>;
}

interface PlayerWriteAdapter {
  updatePlayerFields(payload: UpdatePlayerRequest): Promise<PlayerDbRecord>;
}

interface SupabaseQueryError {
  code?: string;
  message: string;
}

interface SeasonStandingRow {
  player_id: string | null;
  competition_id: string | null;
  category_id: string | null;
  placement: number | null;
  season_points: number | string | null;
}

interface CompetitionNameRow {
  competition_id: string;
  competition_name: string;
}

interface SeasonStandingScoredRow {
  competitionId: string | null;
  placement: number | null;
  seasonPoints: number;
  competitionClass: CompetitionClass;
}

interface SeasonConfigRow {
  season_code: string;
  best_leagues_count: number | null;
  best_tournaments_count: number | null;
}

interface PlayerCompetitionResultRow {
  competition_id: string;
  sum: number | null;
  dnf: boolean;
}

interface CompetitionSummaryRow {
  competition_id: string;
  competition_name: string;
  competition_date: string;
  category_id: string | null;
  parent_id?: string | null;
  record_type?: string | null;
}

interface CategorySummaryRow {
  category_id: string;
  name: string;
}

interface CompetitionResultRankingRow {
  competition_id: string;
  player_id: string;
  sum: number | null;
  dnf: boolean;
}

interface RankedCompetitionResult {
  player_id: string;
  placement: number;
}

interface PlayerCompetitionCountRow {
  player_id: string;
  competitions_count: number | null;
}

interface RpcPlayerResultRow {
  competition_id: string;
  competition_name: string;
  competition_date: string;
  category: string | null;
  placement: number | null;
  sum: number | null;
  dnf: boolean;
  season_points: number | string | null;
}

export interface PlayerCompetitionOwnerProjectionRow {
  sourceCompetitionId: string;
  ownerCompetitionId: string;
  sum: number | null;
  dnf: boolean;
}

export interface PlayersRouteDependencies {
  listPlayers?: (filters?: PlayersListFilters) => Promise<Player[]>;
  getPlayer?: (playerId: string) => Promise<Player | null>;
  listPlayerResults?: (
    filters: PlayerResultsFilters,
  ) => Promise<PlayerCompetitionResult[]>;
  updatePlayer?: (payload: UpdatePlayerRequest) => Promise<Player>;
}

export interface PlayerResultsFilters {
  playerId: string;
  seasonCode?: string;
  dateFrom?: string;
  dateTo?: string;
  limit: number;
  offset: number;
}

async function loadCompetitionHierarchy(
  competitionIds: readonly string[],
): Promise<Map<string, CompetitionHierarchyRow>> {
  const supabase = createApiSupabaseAdminClient();
  return loadCompetitionHierarchyContext(
    competitionIds,
    createSupabaseCompetitionHierarchyLoader(supabase, "player results"),
  );
}

function resolveSeasonPointsCompetitionIdForPlayerResult(
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

function comparePlayerCompetitionOwnerProjectionRows(
  left: PlayerCompetitionOwnerProjectionRow,
  right: PlayerCompetitionOwnerProjectionRow,
): number {
  const leftIsRanked = !left.dnf && left.sum !== null;
  const rightIsRanked = !right.dnf && right.sum !== null;
  if (leftIsRanked !== rightIsRanked) {
    return leftIsRanked ? -1 : 1;
  }

  const leftIsOwnerRow = left.sourceCompetitionId === left.ownerCompetitionId;
  const rightIsOwnerRow = right.sourceCompetitionId === right.ownerCompetitionId;
  if (leftIsOwnerRow !== rightIsOwnerRow) {
    return leftIsOwnerRow ? -1 : 1;
  }

  const leftSum = left.sum ?? Number.POSITIVE_INFINITY;
  const rightSum = right.sum ?? Number.POSITIVE_INFINITY;
  if (leftSum !== rightSum) {
    return leftSum - rightSum;
  }

  return left.sourceCompetitionId.localeCompare(right.sourceCompetitionId, "ru");
}

export function pickOwnerCompetitionResultRows(
  rows: readonly PlayerCompetitionOwnerProjectionRow[],
): Map<string, PlayerCompetitionOwnerProjectionRow> {
  const rowsByOwnerCompetitionId = new Map<string, PlayerCompetitionOwnerProjectionRow[]>();

  for (const row of rows) {
    const currentRows = rowsByOwnerCompetitionId.get(row.ownerCompetitionId) ?? [];
    currentRows.push(row);
    rowsByOwnerCompetitionId.set(row.ownerCompetitionId, currentRows);
  }

  const selectedByOwnerCompetitionId = new Map<string, PlayerCompetitionOwnerProjectionRow>();
  for (const [ownerCompetitionId, ownerRows] of rowsByOwnerCompetitionId.entries()) {
    const [selectedRow] = [...ownerRows].sort(comparePlayerCompetitionOwnerProjectionRows);
    if (!selectedRow) {
      continue;
    }

    selectedByOwnerCompetitionId.set(ownerCompetitionId, selectedRow);
  }

  return selectedByOwnerCompetitionId;
}

function toPlayer(record: PlayerDbRecord): Player {
  return {
    playerId: record.player_id,
    playerName: record.player_name,
    division: record.division,
    rdga: record.rdga,
    rdgaSince: record.rdga_since,
    seasonDivision: record.season_division,
    seasonPoints: record.season_points ?? null,
    seasonCreditPoints: record.season_credit_points ?? null,
    competitionsCount: record.competitions_count ?? 0,
    seasonCreditCompetitions: record.season_credit_competitions,
  };
}

function isMissingPlayerCompetitionCountsTableError(
  error: SupabaseQueryError | null,
): boolean {
  if (!error) {
    return false;
  }

  if (error.code === "42P01") {
    return true;
  }

  return (
    error.code?.startsWith("PGRST") === true &&
    error.message.toLowerCase().includes("player_competition_counts")
  );
}

function isMissingPlayerResultsRpcError(error: SupabaseQueryError | null): boolean {
  if (!error) {
    return false;
  }

  if (error.code === "42883" || error.code === "42P01") {
    return true;
  }

  return (
    error.code?.startsWith("PGRST") === true &&
    error.message.toLowerCase().includes("get_player_results_aggregated")
  );
}

async function loadPlayerCompetitionCountsByPlayerId(
  supabase: ReturnType<typeof createApiSupabaseAdminClient>,
  playerIds: readonly string[],
): Promise<Map<string, number> | null> {
  if (playerIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .schema(APP_PUBLIC_SCHEMA)
    .from("player_competition_counts")
    .select("player_id, competitions_count")
    .in("player_id", playerIds);

  if (error) {
    if (isMissingPlayerCompetitionCountsTableError(error)) {
      return null;
    }

    throw new Error(`Failed to load player competition counts read-model: ${error.message}`);
  }

  return new Map(
    ((data ?? []) as PlayerCompetitionCountRow[]).map((row) => [
      row.player_id,
      Number.isFinite(Number(row.competitions_count)) ? Number(row.competitions_count) : 0,
    ]),
  );
}

async function loadPaginatedSeasonStandingsRows(
  loadPage: (from: number, to: number) => Promise<SeasonStandingRow[]>,
  pageSize: number = SEASON_STANDINGS_PAGE_SIZE,
): Promise<SeasonStandingRow[]> {
  const rows: SeasonStandingRow[] = [];
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;
    const pageRows = await loadPage(from, to);
    rows.push(...pageRows);

    if (pageRows.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return rows;
}

function toPlayerResultFromRpcRow(row: RpcPlayerResultRow): PlayerCompetitionResult {
  return {
    competitionId: row.competition_id,
    competitionName: row.competition_name,
    competitionDate: row.competition_date,
    category: row.category,
    placement: row.placement,
    sum: row.sum,
    dnf: row.dnf,
    seasonPoints:
      row.season_points == null ? null : Number.isFinite(Number(row.season_points))
        ? Number(row.season_points)
        : null,
  };
}

function chunkArray<T>(values: readonly T[], chunkSize: number): T[][] {
  if (values.length === 0) {
    return [];
  }

  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += chunkSize) {
    chunks.push(values.slice(index, index + chunkSize) as T[]);
  }

  return chunks;
}

async function loadCompetitionHierarchyRowsByCompetitionIds(
  supabase: ReturnType<typeof createApiSupabaseAdminClient>,
  competitionIds: readonly string[],
): Promise<Map<string, CompetitionHierarchyRow>> {
  const rowsByCompetitionId = new Map<string, CompetitionHierarchyRow>();
  for (const idsChunk of chunkArray(competitionIds, 200)) {
    const { data, error } = await supabase
      .schema(APP_PUBLIC_SCHEMA)
      .from("competitions")
      .select("competition_id, parent_id, record_type")
      .in("competition_id", idsChunk);

    if (error) {
      throw new Error(
        `Failed to load competition hierarchy roots for player results: ${error.message}`,
      );
    }

    for (const row of (data ?? []) as CompetitionHierarchyRow[]) {
      rowsByCompetitionId.set(row.competition_id, row);
    }
  }

  return rowsByCompetitionId;
}

async function loadCompetitionHierarchyDescendantRows(
  supabase: ReturnType<typeof createApiSupabaseAdminClient>,
  parentCompetitionIds: readonly string[],
): Promise<Map<string, CompetitionHierarchyRow>> {
  const descendantsByCompetitionId = new Map<string, CompetitionHierarchyRow>();
  let pendingParentCompetitionIds = [...new Set(parentCompetitionIds)];

  while (pendingParentCompetitionIds.length > 0) {
    const nextParentCompetitionIds = new Set<string>();
    for (const parentIdsChunk of chunkArray(pendingParentCompetitionIds, 200)) {
      const { data, error } = await supabase
        .schema(APP_PUBLIC_SCHEMA)
        .from("competitions")
        .select("competition_id, parent_id, record_type")
        .in("parent_id", parentIdsChunk);

      if (error) {
        throw new Error(
          `Failed to load competition hierarchy descendants for player results: ${error.message}`,
        );
      }

      for (const row of (data ?? []) as CompetitionHierarchyRow[]) {
        if (descendantsByCompetitionId.has(row.competition_id)) {
          continue;
        }

        descendantsByCompetitionId.set(row.competition_id, row);
        nextParentCompetitionIds.add(row.competition_id);
      }
    }

    pendingParentCompetitionIds = [...nextParentCompetitionIds];
  }

  return descendantsByCompetitionId;
}

async function resolvePlayerResultPlacementByOwnerCompetitionAndPlayerId(
  supabase: ReturnType<typeof createApiSupabaseAdminClient>,
  ownerCompetitionIds: readonly string[],
): Promise<Map<string, number>> {
  if (ownerCompetitionIds.length === 0) {
    return new Map();
  }

  const rootsByCompetitionId = await loadCompetitionHierarchyRowsByCompetitionIds(
    supabase,
    ownerCompetitionIds,
  );
  const descendantsByCompetitionId = await loadCompetitionHierarchyDescendantRows(
    supabase,
    ownerCompetitionIds,
  );
  const hierarchyByCompetitionId = new Map<string, CompetitionHierarchyRow>([
    ...rootsByCompetitionId.entries(),
    ...descendantsByCompetitionId.entries(),
  ]);

  const hierarchyNodes = [...hierarchyByCompetitionId.values()].map((competition) => ({
    competitionId: competition.competition_id,
    parentId: competition.parent_id,
    recordType: competition.record_type,
  }));
  const childrenByParentId = buildCompetitionChildrenByParentId(hierarchyNodes);

  const sourceCompetitionIdsByOwnerCompetitionId = new Map<string, string[]>();
  for (const ownerCompetitionId of ownerCompetitionIds) {
    const ownerCompetition = hierarchyByCompetitionId.get(ownerCompetitionId);
    if (!ownerCompetition) {
      sourceCompetitionIdsByOwnerCompetitionId.set(ownerCompetitionId, [ownerCompetitionId]);
      continue;
    }

    sourceCompetitionIdsByOwnerCompetitionId.set(
      ownerCompetitionId,
      resolveCompetitionResultSourceIds(
        {
          competitionId: ownerCompetition.competition_id,
          parentId: ownerCompetition.parent_id,
          recordType: ownerCompetition.record_type,
        },
        childrenByParentId,
      ),
    );
  }

  const sourceCompetitionIds = [...new Set(
    [...sourceCompetitionIdsByOwnerCompetitionId.values()].flat(),
  )];
  if (sourceCompetitionIds.length === 0) {
    return new Map();
  }

  const rankingRows: CompetitionResultRankingRow[] = [];
  for (const sourceIdsChunk of chunkArray(sourceCompetitionIds, 200)) {
    const { data, error } = await supabase
      .schema(APP_PUBLIC_SCHEMA)
      .from("competition_results")
      .select("competition_id, player_id, sum, dnf")
      .in("competition_id", sourceIdsChunk);

    if (error) {
      throw new Error(
        `Failed to load competition rankings for player results: ${error.message}`,
      );
    }

    rankingRows.push(...((data ?? []) as CompetitionResultRankingRow[]));
  }

  return buildPlacementByOwnerCompetitionAndPlayerId(
    sourceCompetitionIdsByOwnerCompetitionId,
    rankingRows,
  );
}

export function buildPlacementByOwnerCompetitionAndPlayerId(
  sourceCompetitionIdsByOwnerCompetitionId: ReadonlyMap<string, readonly string[]>,
  rankingRows: readonly CompetitionResultRankingRow[],
): Map<string, number> {
  const resultsByCompetitionId = new Map<string, CompetitionResultRankingRow[]>();
  for (const row of rankingRows) {
    const currentRows = resultsByCompetitionId.get(row.competition_id) ?? [];
    currentRows.push(row);
    resultsByCompetitionId.set(row.competition_id, currentRows);
  }

  const placementByOwnerCompetitionAndPlayerId = new Map<string, number>();
  for (const [ownerCompetitionId, ownerSourceCompetitionIds] of sourceCompetitionIdsByOwnerCompetitionId.entries()) {
    const ownerRows = ownerSourceCompetitionIds.flatMap(
      (sourceCompetitionId) => resultsByCompetitionId.get(sourceCompetitionId) ?? [],
    );
    const rankedResults = rankCompetitionResultsForSeasonPoints(
      ownerRows,
      ownerSourceCompetitionIds,
    );
    for (const rankedResult of rankedResults) {
      placementByOwnerCompetitionAndPlayerId.set(
        `${ownerCompetitionId}:${rankedResult.player_id}`,
        rankedResult.placement,
      );
    }
  }

  return placementByOwnerCompetitionAndPlayerId;
}

async function alignPlayerResultsWithSeasonRanking(
  supabase: ReturnType<typeof createApiSupabaseAdminClient>,
  rows: readonly PlayerCompetitionResult[],
  playerId: string,
): Promise<PlayerCompetitionResult[]> {
  if (rows.length === 0) {
    return [];
  }

  const ownerCompetitionIds = [...new Set(
    rows
      .map((row) => row.competitionId?.trim() ?? "")
      .filter((competitionId) => competitionId.length > 0),
  )];
  if (ownerCompetitionIds.length === 0) {
    return [...rows];
  }

  const placementByOwnerCompetitionAndPlayerId =
    await resolvePlayerResultPlacementByOwnerCompetitionAndPlayerId(
      supabase,
      ownerCompetitionIds,
    );

  return rows.map((row) => {
    const resolvedPlacement =
      placementByOwnerCompetitionAndPlayerId.get(`${row.competitionId}:${playerId}`) ?? null;
    return alignPlayerResultPlacement(row, resolvedPlacement);
  });
}

export function alignPlayerResultPlacement(
  row: PlayerCompetitionResult,
  resolvedPlacement: number | null,
): PlayerCompetitionResult {
  const placement = resolvedPlacement ?? row.placement ?? null;

  return {
    ...row,
    placement,
    dnf: placement === null ? row.dnf : false,
  };
}

function createSupabasePlayerReadAdapter(): PlayerReadAdapter {
  const supabase = createApiSupabaseAdminClient();

  return {
    async listPlayers(filters = {}) {
      let { data, error } = await supabase
        .schema(APP_PUBLIC_SCHEMA)
        .from("players")
        .select(PLAYERS_SELECT_COLUMNS)
        .order("player_name", { ascending: true });

      if (isMissingPlayersColumnsError(error)) {
        const legacyResponse = await supabase
          .schema(APP_PUBLIC_SCHEMA)
          .from("players")
          .select(PLAYERS_SELECT_COLUMNS_LEGACY)
          .order("player_name", { ascending: true });

        data = legacyResponse.data;
        error = legacyResponse.error;
      }

      if (error) {
        throw new Error(`Failed to load players list: ${error.message}`);
      }

      const players = ((data ?? []) as unknown as PlayerDbRecord[]).map((player) => ({
        ...player,
      }));
      const playerIds = players
        .map((player) => player.player_id?.trim() ?? "")
        .filter((playerId) => playerId.length > 0);
      const readModelCompetitionCountsByPlayerId =
        await loadPlayerCompetitionCountsByPlayerId(supabase, playerIds);
      const fallbackCompetitionCountsByPlayerId = new Map<string, number>();

      if (!readModelCompetitionCountsByPlayerId) {
        const { data: fallbackCountRows, error: fallbackCountError } = await supabase
          .schema(APP_PUBLIC_SCHEMA)
          .from("competition_results")
          .select("player_id, competition_id")
          .in("player_id", playerIds);

        if (fallbackCountError) {
          throw new Error(
            `Failed to load player competition counts: ${fallbackCountError.message}`,
          );
        }

        const fallbackCompetitionIdsByPlayerId = new Map<string, Set<string>>();
        for (const row of (fallbackCountRows ?? []) as Array<{
          player_id: string | null;
          competition_id: string | null;
        }>) {
          const playerId = row.player_id?.trim();
          const competitionId = row.competition_id?.trim();
          if (!playerId) {
            continue;
          }
          if (!competitionId) {
            continue;
          }

          const playerCompetitionIds =
            fallbackCompetitionIdsByPlayerId.get(playerId) ?? new Set<string>();
          playerCompetitionIds.add(competitionId);
          fallbackCompetitionIdsByPlayerId.set(playerId, playerCompetitionIds);
        }

        for (const [playerId, competitionIds] of fallbackCompetitionIdsByPlayerId.entries()) {
          fallbackCompetitionCountsByPlayerId.set(playerId, competitionIds.size);
        }
      }

      let seasonPointsByPlayerId = new Map<string, number>();
      let seasonCompetitionCountByPlayerId = new Map<string, number>();
      let seasonCreditPointsByPlayerId = new Map<string, number>();
      let seasonCreditCompetitionsByPlayerId = new Map<string, PlayerSeasonCreditCompetition[]>();

      if (filters.seasonCode) {
        const seasonStandings = await loadPaginatedSeasonStandingsRows(async (from, to) => {
          const { data, error } = await supabase
            .schema(APP_PUBLIC_SCHEMA)
            .from("season_standings")
            .select(SEASON_STANDINGS_SELECT_COLUMNS)
            .eq("season_code", filters.seasonCode)
            .range(from, to);

          if (error && !isMissingSeasonStandingsTableError(error)) {
            throw new Error(
              `Failed to load season standings for players list: ${error.message}`,
            );
          }

          return ((data ?? []) as unknown as SeasonStandingRow[]).map((row) => ({ ...row }));
        });

        const aggregatedSeasonStandings = aggregateSeasonStandingsByPlayer(
          seasonStandings,
          await loadSeasonCreditAggregationConfig(
            supabase,
            filters.seasonCode,
            seasonStandings,
          ),
          await loadCompetitionNameByCompetitionId(
            supabase,
            seasonStandings,
          ),
        );
        seasonPointsByPlayerId = aggregatedSeasonStandings.seasonPointsByPlayerId;
        seasonCompetitionCountByPlayerId =
          aggregatedSeasonStandings.seasonCompetitionCountByPlayerId;
        seasonCreditPointsByPlayerId =
          aggregatedSeasonStandings.seasonCreditPointsByPlayerId;
        seasonCreditCompetitionsByPlayerId =
          aggregatedSeasonStandings.seasonCreditCompetitionsByPlayerId;
      }

      return players.map((player) => ({
        ...player,
        season_points: seasonPointsByPlayerId.get(player.player_id) ?? null,
        season_credit_points:
          seasonCreditPointsByPlayerId.get(player.player_id) ?? null,
        season_credit_competitions:
          filters.seasonCode
            ? seasonCreditCompetitionsByPlayerId.get(player.player_id) ?? []
            : undefined,
        competitions_count: filters.seasonCode
          ? seasonCompetitionCountByPlayerId.get(player.player_id) ?? 0
          : (readModelCompetitionCountsByPlayerId?.get(player.player_id) ??
            fallbackCompetitionCountsByPlayerId.get(player.player_id) ??
            0),
      }));
    },
    async getPlayerById(playerId) {
      const initialResponse = await supabase
        .schema(APP_PUBLIC_SCHEMA)
        .from("players")
        .select(PLAYERS_SELECT_COLUMNS)
        .eq("player_id", playerId)
        .maybeSingle();
      let playerData = (initialResponse.data ?? null) as PlayerDbRecord | null;
      let playerError = initialResponse.error as SupabaseQueryError | null;

      if (isMissingPlayersColumnsError(playerError)) {
        const legacyResponse = await supabase
          .schema(APP_PUBLIC_SCHEMA)
          .from("players")
          .select(PLAYERS_SELECT_COLUMNS_LEGACY)
          .eq("player_id", playerId)
          .maybeSingle();

        playerData = legacyResponse.data
          ? {
              ...(legacyResponse.data as unknown as PlayerDbRecord),
              rdga: null,
              rdga_since: null,
              season_division: null,
            }
          : null;
        playerError = legacyResponse.error as SupabaseQueryError | null;
      }

      if (playerError) {
        throw new Error(`Failed to load player: ${playerError.message}`);
      }

      if (!playerData) {
        return null;
      }

      const readModelCompetitionCountsByPlayerId = await loadPlayerCompetitionCountsByPlayerId(
        supabase,
        [playerId],
      );
      let competitionsCount = readModelCompetitionCountsByPlayerId?.get(playerId);

      if (competitionsCount == null) {
        const { data: fallbackCountRows, error: fallbackCountError } = await supabase
          .schema(APP_PUBLIC_SCHEMA)
          .from("competition_results")
          .select("competition_id")
          .eq("player_id", playerId);

        if (fallbackCountError) {
          throw new Error(
            `Failed to load player competition counts: ${fallbackCountError.message}`,
          );
        }

        competitionsCount = new Set(
          ((fallbackCountRows ?? []) as Array<{ competition_id: string | null }>)
            .map((row) => row.competition_id?.trim() ?? "")
            .filter((competitionId) => competitionId.length > 0),
        ).size;
      }

      return {
        ...playerData,
        season_points: null,
        season_credit_points: null,
        competitions_count: competitionsCount ?? 0,
      };
    },
    async listPlayerResults(filters) {
      const { data: rpcRows, error: rpcError } = await supabase
        .schema(APP_PUBLIC_SCHEMA)
        .rpc("get_player_results_aggregated", {
          p_player_id: filters.playerId,
          p_season_code: filters.seasonCode ?? null,
          p_date_from: filters.dateFrom ?? null,
          p_date_to: filters.dateTo ?? null,
          p_limit: filters.limit,
          p_offset: filters.offset,
        });

      if (!rpcError) {
        const rows = ((rpcRows ?? []) as RpcPlayerResultRow[]).map(toPlayerResultFromRpcRow);
        return alignPlayerResultsWithSeasonRanking(supabase, rows, filters.playerId);
      }

      if (!isMissingPlayerResultsRpcError(rpcError)) {
        throw new Error(`Failed to load player results RPC read model: ${rpcError.message}`);
      }

      const { data: playerRows, error: playerResultsError } = await supabase
        .schema(APP_PUBLIC_SCHEMA)
        .from("competition_results")
        .select(PLAYER_COMPETITION_RESULTS_SELECT_COLUMNS)
        .eq("player_id", filters.playerId);

      if (playerResultsError) {
        throw new Error(
          `Failed to load player competition results: ${playerResultsError.message}`,
        );
      }

      const playerResultRows =
        ((playerRows ?? []) as unknown as PlayerCompetitionResultRow[]).map((row) => ({
          ...row,
        }));
      const competitionIds = [
        ...new Set(
          playerResultRows
            .map((row) => row.competition_id?.trim() ?? "")
            .filter((competitionId) => competitionId.length > 0),
        ),
      ];

      if (competitionIds.length === 0) {
        return [];
      }

      const competitionsById = await loadCompetitionHierarchy(competitionIds);
      const ownerCompetitionIdByCompetitionId =
        buildOwnerCompetitionIdByCompetitionId(competitionsById);
      const ownerCompetitionIdBySourceCompetitionId = new Map<string, string>();
      for (const competitionId of competitionIds) {
        ownerCompetitionIdBySourceCompetitionId.set(
          competitionId,
          ownerCompetitionIdByCompetitionId.get(competitionId) ?? competitionId,
        );
      }

      const ownerCompetitionIds = [
        ...new Set(ownerCompetitionIdBySourceCompetitionId.values()),
      ];
      if (ownerCompetitionIds.length === 0) {
        return [];
      }

      let competitionsQuery = supabase
        .schema(APP_PUBLIC_SCHEMA)
        .from("competitions")
        .select(PLAYER_COMPETITIONS_SELECT_COLUMNS)
        .in("competition_id", ownerCompetitionIds)
        .order("competition_date", { ascending: false });

      if (filters.dateFrom) {
        competitionsQuery = competitionsQuery.gte("competition_date", filters.dateFrom);
      }

      if (filters.dateTo) {
        competitionsQuery = competitionsQuery.lte("competition_date", filters.dateTo);
      }

      const { data: competitionRows, error: competitionsError } = await competitionsQuery;
      if (competitionsError) {
        throw new Error(
          `Failed to load competitions for player results: ${competitionsError.message}`,
        );
      }

      const competitionSummaries =
        ((competitionRows ?? []) as unknown as CompetitionSummaryRow[]).map((row) => ({
          ...row,
        }));
      const visibleCompetitionIds = new Set(
        competitionSummaries
          .map((row) => row.competition_id?.trim() ?? "")
          .filter((competitionId) => competitionId.length > 0),
      );

      if (visibleCompetitionIds.size === 0) {
        return [];
      }

      const categoryIds = [
        ...new Set(
          competitionSummaries
            .map((row) => row.category_id?.trim() ?? "")
            .filter((categoryId) => categoryId.length > 0),
        ),
      ];

      const categoriesById = new Map<string, string>();
      if (categoryIds.length > 0) {
        const { data: categoryRows, error: categoriesError } = await supabase
          .schema(APP_PUBLIC_SCHEMA)
          .from("tournament_categories")
          .select(TOURNAMENT_CATEGORIES_NAME_SELECT_COLUMNS)
          .in("category_id", categoryIds);

        if (categoriesError) {
          throw new Error(
            `Failed to load category names for player results: ${categoriesError.message}`,
          );
        }

        for (const category of (categoryRows ?? []) as unknown as CategorySummaryRow[]) {
          categoriesById.set(category.category_id, category.name);
        }
      }

      const { data: allResultsRows, error: allResultsError } = await supabase
        .schema(APP_PUBLIC_SCHEMA)
        .from("competition_results")
        .select("competition_id, player_id, sum, dnf")
        .in(
          "competition_id",
          [
            ...new Set(
              playerResultRows
                .map((row) => row.competition_id?.trim() ?? "")
                .filter((competitionId) => competitionId.length > 0)
                .filter((competitionId) => {
                  const ownerCompetitionId = ownerCompetitionIdBySourceCompetitionId.get(
                    competitionId,
                  );
                  return ownerCompetitionId
                    ? visibleCompetitionIds.has(ownerCompetitionId)
                    : false;
                }),
            ),
          ],
        );

      if (allResultsError) {
        throw new Error(
          `Failed to load competition rankings for player results: ${allResultsError.message}`,
        );
      }

      const placementByCompetitionPlayerKey = new Map<string, number>();
      const allResultsByCompetition = new Map<
        string,
        Array<{ player_id: string; sum: number | null; dnf: boolean }>
      >();

      for (const row of (allResultsRows ?? []) as unknown as Array<{
        competition_id: string;
        player_id: string;
        sum: number | null;
        dnf: boolean;
      }>) {
        const competitionId = row.competition_id?.trim();
        const playerId = row.player_id?.trim();

        if (!competitionId || !playerId) {
          continue;
        }

        const currentRows = allResultsByCompetition.get(competitionId) ?? [];
        currentRows.push({
          player_id: playerId,
          sum: row.sum,
          dnf: row.dnf,
        });
        allResultsByCompetition.set(competitionId, currentRows);
      }

      for (const [competitionId, competitionResults] of allResultsByCompetition.entries()) {
        const rankedResults = rankCompetitionResultsForPlayerView(competitionResults);
        for (const rankedResult of rankedResults) {
          placementByCompetitionPlayerKey.set(
            `${competitionId}:${rankedResult.player_id}`,
            rankedResult.placement,
          );
        }
      }

      let seasonStandingByCompetitionId = new Map<
        string,
        { seasonPoints: number; placement: number | null }
      >();
      if (filters.seasonCode) {
        const { data: seasonRows, error: seasonError } = await supabase
          .schema(APP_PUBLIC_SCHEMA)
          .from("season_standings")
          .select("competition_id, season_points, placement")
          .eq("player_id", filters.playerId)
          .eq("season_code", filters.seasonCode)
          .in("competition_id", [...visibleCompetitionIds]);

        if (seasonError && !isMissingSeasonStandingsTableError(seasonError)) {
          throw new Error(
            `Failed to load season points for player results: ${seasonError.message}`,
          );
        }

        seasonStandingByCompetitionId = new Map(
          (
            (seasonRows ?? []) as Array<{
              competition_id: string;
              season_points: number | string | null;
              placement: number | null;
            }>
          )
            .map((row) => {
              const competitionId = row.competition_id?.trim() ?? "";
              const seasonPoints = Number(row.season_points);
              if (competitionId.length === 0 || !Number.isFinite(seasonPoints)) {
                return null;
              }

              return [
                competitionId,
                {
                  seasonPoints,
                  placement: row.placement ?? null,
                },
              ] as const;
            })
            .filter(
              (entry): entry is readonly [string, { seasonPoints: number; placement: number | null }] =>
                entry !== null,
            ),
        );
      }

      const competitionById = new Map(
        competitionSummaries.map((competition) => [competition.competition_id, competition]),
      );

      const ownerProjectionRows = playerResultRows
        .map((row) => {
          const sourceCompetitionId = row.competition_id?.trim() ?? "";
          if (sourceCompetitionId.length === 0) {
            return null;
          }

          const ownerCompetitionId = ownerCompetitionIdBySourceCompetitionId.get(
            sourceCompetitionId,
          );
          if (!ownerCompetitionId || !visibleCompetitionIds.has(ownerCompetitionId)) {
            return null;
          }

          return {
            sourceCompetitionId,
            ownerCompetitionId,
            sum: row.sum,
            dnf: row.dnf,
          } satisfies PlayerCompetitionOwnerProjectionRow;
        })
        .filter((row): row is PlayerCompetitionOwnerProjectionRow => row !== null);

      const selectedRowsByOwnerCompetitionId = pickOwnerCompetitionResultRows(
        ownerProjectionRows,
      );

      const aggregatedRows = [...selectedRowsByOwnerCompetitionId.entries()]
        .map(([ownerCompetitionId, selectedRow]) => {
          const competition = competitionById.get(ownerCompetitionId);
          if (!competition) {
            return null;
          }

          const categoryId = competition.category_id?.trim() ?? "";
          const categoryName =
            categoryId.length > 0 ? (categoriesById.get(categoryId) ?? categoryId) : null;
          const seasonStanding = seasonStandingByCompetitionId.get(ownerCompetitionId) ?? null;
          const seasonPlacement = seasonStanding?.placement ?? null;
          const hasSeasonPlacement = typeof seasonPlacement === "number";
          const placementFromResults = selectedRow.dnf
            ? null
            : (placementByCompetitionPlayerKey.get(
                `${selectedRow.sourceCompetitionId}:${filters.playerId}`,
              ) ?? null);

          return {
            competitionId: competition.competition_id,
            competitionName: competition.competition_name,
            competitionDate: competition.competition_date,
            category: categoryName,
            placement: seasonPlacement ?? placementFromResults,
            sum: selectedRow.sum,
            dnf: hasSeasonPlacement ? false : selectedRow.dnf,
            seasonPoints: seasonStanding?.seasonPoints ?? null,
          } satisfies PlayerCompetitionResult;
        })
        .filter((row): row is PlayerCompetitionResult => row !== null)
        .sort((left, right) => {
          const dateComparison = right.competitionDate.localeCompare(left.competitionDate, "ru");
          if (dateComparison !== 0) {
            return dateComparison;
          }

          return left.competitionName.localeCompare(right.competitionName, "ru");
        });

      return alignPlayerResultsWithSeasonRanking(
        supabase,
        aggregatedRows.slice(filters.offset, filters.offset + filters.limit),
        filters.playerId,
      );
    },
  };
}

export function aggregateSeasonStandingsByPlayer(rows: SeasonStandingRow[]): {
  seasonPointsByPlayerId: Map<string, number>;
  seasonCompetitionCountByPlayerId: Map<string, number>;
  seasonCreditPointsByPlayerId: Map<string, number>;
  seasonCreditCompetitionsByPlayerId: Map<string, PlayerSeasonCreditCompetition[]>;
};
export function aggregateSeasonStandingsByPlayer(
  rows: SeasonStandingRow[],
  seasonCreditConfig: SeasonCreditAggregationConfig,
  competitionNameByCompetitionId: ReadonlyMap<string, string>,
): {
  seasonPointsByPlayerId: Map<string, number>;
  seasonCompetitionCountByPlayerId: Map<string, number>;
  seasonCreditPointsByPlayerId: Map<string, number>;
  seasonCreditCompetitionsByPlayerId: Map<string, PlayerSeasonCreditCompetition[]>;
};
export function aggregateSeasonStandingsByPlayer(
  rows: SeasonStandingRow[],
  seasonCreditConfig?: SeasonCreditAggregationConfig,
  competitionNameByCompetitionId: ReadonlyMap<string, string> = new Map(),
): {
  seasonPointsByPlayerId: Map<string, number>;
  seasonCompetitionCountByPlayerId: Map<string, number>;
  seasonCreditPointsByPlayerId: Map<string, number>;
  seasonCreditCompetitionsByPlayerId: Map<string, PlayerSeasonCreditCompetition[]>;
} {
  const seasonPointsByPlayerId = new Map<string, number>();
  const competitionIdsByPlayerId = new Map<string, Set<string>>();
  const scoredRowsByPlayerId = new Map<string, SeasonStandingScoredRow[]>();

  for (const row of rows) {
    const playerId = row.player_id?.trim();
    const competitionId = row.competition_id?.trim();
    const categoryId = row.category_id?.trim();
    const seasonPoints = Number(row.season_points);

    if (!playerId) {
      continue;
    }

    if (Number.isFinite(seasonPoints)) {
      seasonPointsByPlayerId.set(
        playerId,
        (seasonPointsByPlayerId.get(playerId) ?? 0) + seasonPoints,
      );

      if (seasonCreditConfig) {
        const competitionClass = resolveCompetitionClassByCategoryId(
          categoryId,
          seasonCreditConfig.competitionClassByCategoryId,
        );
        if (competitionClass) {
          const scoredRows = scoredRowsByPlayerId.get(playerId) ?? [];
          scoredRows.push({
            competitionId: competitionId ?? null,
            placement: row.placement ?? null,
            seasonPoints,
            competitionClass,
          });
          scoredRowsByPlayerId.set(playerId, scoredRows);
        }
      }
    }

    if (!competitionId) {
      continue;
    }

    const competitionIds =
      competitionIdsByPlayerId.get(playerId) ?? new Set<string>();
    competitionIds.add(competitionId);
    competitionIdsByPlayerId.set(playerId, competitionIds);
  }

  const seasonCompetitionCountByPlayerId = new Map<string, number>();

  for (const [playerId, competitionIds] of competitionIdsByPlayerId.entries()) {
    seasonCompetitionCountByPlayerId.set(playerId, competitionIds.size);
  }

  const seasonCreditPointsByPlayerId = new Map<string, number>();
  const seasonCreditCompetitionsByPlayerId = new Map<
    string,
    PlayerSeasonCreditCompetition[]
  >();
  if (seasonCreditConfig) {
    for (const [playerId, scoredRows] of scoredRowsByPlayerId.entries()) {
      const selectedRows = pickSeasonCreditRows(
        scoredRows,
        seasonCreditConfig.bestLeaguesCount,
        seasonCreditConfig.bestTournamentsCount,
      );
      seasonCreditPointsByPlayerId.set(
        playerId,
        roundToTwo(
          selectedRows.reduce((total, row) => total + row.seasonPoints, 0),
        ),
      );
      seasonCreditCompetitionsByPlayerId.set(
        playerId,
        selectedRows
          .filter((row) => typeof row.competitionId === "string" && row.competitionId.length > 0)
          .map((row) => {
            const competitionId = row.competitionId as string;
            return {
              competitionId,
              competitionName:
                competitionNameByCompetitionId.get(competitionId) ?? competitionId,
              placement: row.placement,
              seasonPoints: roundToTwo(row.seasonPoints),
            };
          }),
      );
    }
  }

  return {
    seasonPointsByPlayerId,
    seasonCompetitionCountByPlayerId,
    seasonCreditPointsByPlayerId,
    seasonCreditCompetitionsByPlayerId,
  };
}

interface SeasonCreditAggregationConfig {
  bestLeaguesCount: number;
  bestTournamentsCount: number;
  competitionClassByCategoryId: Map<string, CompetitionClass>;
}

interface CategoryClassificationRow {
  category_id: string;
  competition_class: CompetitionClass | null;
}

function roundToTwo(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function normalizeTopCount(value: number | null | undefined): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value ?? 0));
}

function pickSeasonCreditRows(
  rows: SeasonStandingScoredRow[],
  bestLeaguesCount: number,
  bestTournamentsCount: number,
): SeasonStandingScoredRow[] {
  const leagueRows: SeasonStandingScoredRow[] = [];
  const tournamentRows: SeasonStandingScoredRow[] = [];

  for (const row of rows) {
    if (row.competitionClass === "league") {
      leagueRows.push(row);
      continue;
    }

    tournamentRows.push(row);
  }

  const selectedRows = [
    ...pickTopScoredRows(leagueRows, bestLeaguesCount),
    ...pickTopScoredRows(tournamentRows, bestTournamentsCount),
  ];

  return selectedRows.sort((left, right) => {
    if (left.seasonPoints !== right.seasonPoints) {
      return right.seasonPoints - left.seasonPoints;
    }

    const leftCompetitionId = left.competitionId ?? "";
    const rightCompetitionId = right.competitionId ?? "";
    return leftCompetitionId.localeCompare(rightCompetitionId, "ru");
  });
}

function pickTopScoredRows(
  rows: SeasonStandingScoredRow[],
  limit: number,
): SeasonStandingScoredRow[] {
  if (limit <= 0 || rows.length === 0) {
    return [];
  }

  return [...rows]
    .sort((left, right) => {
      if (left.seasonPoints !== right.seasonPoints) {
        return right.seasonPoints - left.seasonPoints;
      }

      const leftCompetitionId = left.competitionId ?? "";
      const rightCompetitionId = right.competitionId ?? "";
      return leftCompetitionId.localeCompare(rightCompetitionId, "ru");
    })
    .slice(0, limit);
}

function resolveCompetitionClassByCategoryId(
  categoryId: string | undefined,
  competitionClassByCategoryId: ReadonlyMap<string, CompetitionClass>,
): CompetitionClass | null {
  if (!categoryId) {
    return null;
  }

  return competitionClassByCategoryId.get(categoryId) ?? null;
}

function buildCompetitionClassByCategoryId(
  categories: readonly CategoryClassificationRow[],
): Map<string, CompetitionClass> {
  const competitionClassByCategoryId = new Map<string, CompetitionClass>();

  for (const category of categories) {
    const categoryId = category.category_id?.trim();
    if (
      !categoryId ||
      (category.competition_class !== "league" &&
        category.competition_class !== "tournament")
    ) {
      continue;
    }

    competitionClassByCategoryId.set(categoryId, category.competition_class);
  }

  return competitionClassByCategoryId;
}

async function loadSeasonCreditAggregationConfig(
  supabase: ReturnType<typeof createApiSupabaseAdminClient>,
  seasonCode: string,
  seasonStandings: SeasonStandingRow[],
): Promise<SeasonCreditAggregationConfig> {
  const { data: seasonConfig, error: seasonConfigError } = await supabase
    .schema(APP_PUBLIC_SCHEMA)
    .from("seasons")
    .select(SEASONS_SELECT_COLUMNS)
    .eq("season_code", seasonCode)
    .maybeSingle();

  if (seasonConfigError) {
    throw new Error(
      `Failed to load season configuration for players list: ${seasonConfigError.message}`,
    );
  }

  const categoryIds = [
    ...new Set(
      seasonStandings
        .map((row) => row.category_id?.trim() ?? "")
        .filter((categoryId) => categoryId.length > 0),
    ),
  ];

  const categoriesById = new Map<string, CompetitionClass>();
  if (categoryIds.length > 0) {
    const { data: categoryRows, error: categoryError } = await supabase
      .schema(APP_PUBLIC_SCHEMA)
      .from("tournament_categories")
      .select(TOURNAMENT_CATEGORIES_CLASS_SELECT_COLUMNS)
      .in("category_id", categoryIds);

    if (categoryError) {
      throw new Error(
        `Failed to load tournament categories for players list: ${categoryError.message}`,
      );
    }

    const categoryClassificationRows = (categoryRows ?? []) as unknown as CategoryClassificationRow[];
    const resolved = buildCompetitionClassByCategoryId(categoryClassificationRows);
    for (const [categoryId, competitionClass] of resolved.entries()) {
      categoriesById.set(categoryId, competitionClass);
    }
  }

  const seasonRow = seasonConfig as SeasonConfigRow | null;
  return {
    bestLeaguesCount: normalizeTopCount(seasonRow?.best_leagues_count),
    bestTournamentsCount: normalizeTopCount(seasonRow?.best_tournaments_count),
    competitionClassByCategoryId: categoriesById,
  };
}

async function loadCompetitionNameByCompetitionId(
  supabase: ReturnType<typeof createApiSupabaseAdminClient>,
  seasonStandings: SeasonStandingRow[],
): Promise<Map<string, string>> {
  const competitionIds = [
    ...new Set(
      seasonStandings
        .map((row) => row.competition_id?.trim() ?? "")
        .filter((competitionId) => competitionId.length > 0),
    ),
  ];

  if (competitionIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .schema(APP_PUBLIC_SCHEMA)
    .from("competitions")
    .select("competition_id, competition_name")
    .in("competition_id", competitionIds);

  if (error) {
    throw new Error(
      `Failed to load competition names for players list: ${error.message}`,
    );
  }

  const namesByCompetitionId = new Map<string, string>();
  for (const row of (data ?? []) as unknown as CompetitionNameRow[]) {
    const competitionId = row.competition_id?.trim() ?? "";
    if (competitionId.length === 0) {
      continue;
    }

    namesByCompetitionId.set(competitionId, row.competition_name ?? competitionId);
  }

  return namesByCompetitionId;
}

function rankCompetitionResultsForPlayerView(
  results: ReadonlyArray<{ player_id: string; sum: number | null; dnf: boolean }>,
): RankedCompetitionResult[] {
  const eligible = [...results]
    .filter((result) => !result.dnf && result.sum !== null)
    .sort((left, right) => {
      const leftSum = left.sum ?? Number.POSITIVE_INFINITY;
      const rightSum = right.sum ?? Number.POSITIVE_INFINITY;

      if (leftSum !== rightSum) {
        return leftSum - rightSum;
      }

      return left.player_id.localeCompare(right.player_id, "ru");
    });

  const ranked: RankedCompetitionResult[] = [];
  let currentPlacement = 1;
  let index = 0;

  while (index < eligible.length) {
    const result = eligible[index];
    if (!result || result.sum === null) {
      index += 1;
      continue;
    }

    let tieEndIndex = index + 1;
    while (tieEndIndex < eligible.length) {
      const next = eligible[tieEndIndex];
      if (!next || next.sum !== result.sum) {
        break;
      }
      tieEndIndex += 1;
    }

    for (let tieIndex = index; tieIndex < tieEndIndex; tieIndex += 1) {
      const tied = eligible[tieIndex];
      if (!tied) {
        continue;
      }

      ranked.push({
        player_id: tied.player_id,
        placement: currentPlacement,
      });
    }

    currentPlacement += tieEndIndex - index;
    index = tieEndIndex;
  }

  return ranked;
}

function createSupabasePlayerWriteAdapter(): PlayerWriteAdapter {
  const supabase = createApiSupabaseAdminClient();

  return {
    async updatePlayerFields(payload) {
      const response = await supabase
        .schema(APP_PUBLIC_SCHEMA)
        .from("players")
        .update({
          division: payload.division,
          rdga: payload.rdga,
          rdga_since: payload.rdgaSince,
          season_division: payload.seasonDivision,
        })
        .eq("player_id", payload.playerId)
        .select(PLAYERS_SELECT_COLUMNS)
        .single();

      let data = response.data as unknown as PlayerDbRecord | null;
      let error = response.error;

      if (isMissingPlayersColumnsError(error)) {
        const legacyResponse = await supabase
          .schema(APP_PUBLIC_SCHEMA)
          .from("players")
          .update({
            division: payload.division,
          })
          .eq("player_id", payload.playerId)
          .select(PLAYERS_SELECT_COLUMNS_LEGACY)
          .single();

        const legacyData = legacyResponse.data as unknown as PlayerDbRecord | null;

        data = legacyData
          ? {
              ...legacyData,
              rdga: null,
              rdga_since: null,
              season_division: null,
            }
          : legacyData;
        error = legacyResponse.error;
      }

      if (error) {
        throw new Error(`Failed to update player fields: ${error.message}`);
      }

      return data as PlayerDbRecord;
    },
  };
}

function isMissingPlayersColumnsError(error: SupabaseQueryError | null): boolean {
  if (error?.code !== "42703") {
    return false;
  }

  return ["rdga", "rdga_since", "season_division"].some((columnName) =>
    error.message.includes(columnName),
  );
}

function isMissingSeasonStandingsTableError(error: SupabaseQueryError | null): boolean {
  return error?.code === "42P01" && error.message.includes("season_standings");
}

function resolvePlayersListFilters(url: URL): PlayersListFilters {
  const seasonCode = url.searchParams.get("seasonCode")?.trim();

  return seasonCode ? { seasonCode } : {};
}

function normalizeFilterDate(value: string | null, fieldName: string): string | undefined {
  const normalizedValue = value?.trim();
  if (!normalizedValue) {
    return undefined;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedValue)) {
    throw new HttpError(400, "invalid_period", `${fieldName} must use YYYY-MM-DD format`);
  }

  const parsedDate = new Date(`${normalizedValue}T00:00:00.000Z`);
  if (
    Number.isNaN(parsedDate.valueOf()) ||
    parsedDate.toISOString().slice(0, 10) !== normalizedValue
  ) {
    throw new HttpError(400, "invalid_period", `${fieldName} must be a valid calendar date`);
  }

  return normalizedValue;
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

function resolvePlayerResultsFilters(url: URL): PlayerResultsFilters {
  const playerId = url.searchParams.get("playerId")?.trim();
  if (!playerId) {
    throw new HttpError(400, "invalid_player_id", "playerId query parameter is required");
  }

  const seasonCode = url.searchParams.get("seasonCode")?.trim() || undefined;
  const dateFrom = normalizeFilterDate(url.searchParams.get("dateFrom"), "dateFrom");
  const dateTo = normalizeFilterDate(url.searchParams.get("dateTo"), "dateTo");

  if (dateFrom && dateTo && dateFrom > dateTo) {
    throw new HttpError(
      400,
      "invalid_period",
      "dateFrom must be earlier than or equal to dateTo",
    );
  }

  const rawLimit = normalizePaginationNumber(
    url.searchParams.get("limit"),
    DEFAULT_PLAYER_RESULTS_LIMIT,
    "limit",
  );
  const rawOffset = normalizePaginationNumber(url.searchParams.get("offset"), 0, "offset");

  return {
    playerId,
    seasonCode,
    dateFrom,
    dateTo,
    limit: Math.min(rawLimit, MAX_PLAYER_RESULTS_LIMIT),
    offset: rawOffset,
  };
}

function normalizeRdga(value: unknown): boolean | null {
  if (value == null) {
    return null;
  }

  if (typeof value !== "boolean") {
    throw new HttpError(400, "invalid_rdga", "Player RDGA must be a boolean or null");
  }

  return value;
}

function normalizeRdgaSince(value: unknown): string | null {
  if (value == null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new HttpError(
      400,
      "invalid_rdga_since",
      "Player RDGA since must be a date string (YYYY-MM-DD) or null",
    );
  }

  const normalizedValue = value.trim();
  if (normalizedValue.length === 0) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedValue)) {
    throw new HttpError(
      400,
      "invalid_rdga_since",
      "Player RDGA since must be in YYYY-MM-DD format",
    );
  }

  const parsedDate = new Date(`${normalizedValue}T00:00:00.000Z`);
  if (
    Number.isNaN(parsedDate.valueOf()) ||
    parsedDate.toISOString().slice(0, 10) !== normalizedValue
  ) {
    throw new HttpError(
      400,
      "invalid_rdga_since",
      "Player RDGA since must be a valid calendar date",
    );
  }

  return normalizedValue;
}

async function listPlayersFromRuntime(filters?: PlayersListFilters): Promise<Player[]> {
  const adapter = createSupabasePlayerReadAdapter();
  const records = await adapter.listPlayers(filters);

  return records.map(toPlayer);
}

async function getPlayerFromRuntime(playerId: string): Promise<Player | null> {
  const adapter = createSupabasePlayerReadAdapter();
  const player = await adapter.getPlayerById(playerId);
  return player ? toPlayer(player) : null;
}

async function listPlayerResultsFromRuntime(
  filters: PlayerResultsFilters,
): Promise<PlayerCompetitionResult[]> {
  const adapter = createSupabasePlayerReadAdapter();
  return adapter.listPlayerResults(filters);
}

function normalizeDivision(value: unknown): string | null {
  if (value == null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new HttpError(400, "invalid_division", "Player division must be a string or null");
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function normalizeSeasonDivision(value: unknown): string | null {
  if (value == null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new HttpError(
      400,
      "invalid_season_division",
      "Player season division must be a string or null",
    );
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function resolveEffectiveRdgaSince(
  rdga: boolean | null,
  rdgaSince: string | null,
): string | null {
  if (rdga === true && rdgaSince == null) {
    return new Date().toISOString().slice(0, 10);
  }

  return rdgaSince;
}

function parseUpdatePlayerRequestBody(body: unknown): UpdatePlayerRequest {
  if (!body || typeof body !== "object") {
    throw new HttpError(400, "invalid_payload", "Request body must be a JSON object");
  }

  const playerIdValue = "playerId" in body ? body.playerId : undefined;

  if (typeof playerIdValue !== "string" || playerIdValue.trim().length === 0) {
    throw new HttpError(400, "invalid_player_id", "Player id is required");
  }

  const rdga = normalizeRdga("rdga" in body ? body.rdga : null);
  const rdgaSince = normalizeRdgaSince("rdgaSince" in body ? body.rdgaSince : null);

  return {
    playerId: playerIdValue.trim(),
    division: normalizeDivision("division" in body ? body.division : null),
    rdga,
    rdgaSince: resolveEffectiveRdgaSince(rdga, rdgaSince),
    seasonDivision: normalizeSeasonDivision(
      "seasonDivision" in body ? body.seasonDivision : null,
    ),
  };
}

async function updatePlayerFromRuntime(payload: UpdatePlayerRequest): Promise<Player> {
  const adapter = createSupabasePlayerWriteAdapter();
  const record = await adapter.updatePlayerFields(payload);

  return toPlayer(record);
}

export function getPlayersRoutes(
  dependencies: PlayersRouteDependencies = {},
  authDependencies: AuthGuardDependencies = {},
): RouteDefinition[] {
  return [
    {
      method: "GET",
      path: "/players",
      handler: async ({ res, url }) => {
        const pagination = resolveListPagination(url);
        const filters = resolvePlayersListFilters(url);
        const allPlayers = await (dependencies.listPlayers ?? listPlayersFromRuntime)(
          filters,
        );
        const players = allPlayers.slice(
          pagination.offset,
          pagination.offset + pagination.limit,
        );

        sendSuccess(res, players, {
          count: players.length,
          limit: pagination.limit,
          offset: pagination.offset,
        });
      },
    },
    {
      method: "GET",
      path: "/players/results",
      handler: async ({ res, url }) => {
        const filters = resolvePlayerResultsFilters(url);
        const results = await (
          dependencies.listPlayerResults ?? listPlayerResultsFromRuntime
        )(filters);

        sendSuccess(res, results, {
          count: results.length,
          limit: filters.limit,
          offset: filters.offset,
        });
      },
    },
    {
      method: "GET",
      path: "/players/:playerId",
      handler: async ({ res, params }) => {
        const playerId = params.playerId?.trim();
        if (!playerId) {
          throw new HttpError(400, "invalid_player_id", "playerId path parameter is required");
        }

        const player = await (dependencies.getPlayer ?? getPlayerFromRuntime)(playerId);
        if (!player) {
          throw new HttpError(404, "not_found", "Player not found");
        }

        sendSuccess(res, player);
      },
    },
    {
      method: "PUT",
      path: "/players",
      handler: async ({ req, res }) => {
        await requireAuthenticatedUser(readSessionToken(req), authDependencies);

        const body = await readJsonBody<UpdatePlayerRequest>(req);
        const payload = parseUpdatePlayerRequestBody(body);
        const player = await (dependencies.updatePlayer ?? updatePlayerFromRuntime)(
          payload,
        );

        sendSuccess(res, player);
      },
    },
  ];
}
