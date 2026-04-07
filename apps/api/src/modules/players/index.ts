import type {
  Player,
  PlayerCompetitionResult,
  PlayerDbRecord,
  UpdatePlayerRequest,
} from "@metrix-parser/shared-types";
import { resolveSeasonPointsCompetitionOwnerId } from "@metrix-parser/shared-types";

import { readJsonBody, sendSuccess } from "../../lib/http";
import { HttpError } from "../../lib/http-errors";
import type { RouteDefinition } from "../../lib/router";
import { createApiSupabaseAdminClient } from "../../lib/supabase-admin";
import {
  readSessionToken,
  requireAuthenticatedUser,
  type AuthGuardDependencies,
} from "../auth/runtime";

const APP_PUBLIC_SCHEMA = "app_public";
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

const PLAYER_RESULT_COUNTS_SELECT_COLUMNS = [
  "player_id",
  "competition_id",
].join(", ");

const SEASON_STANDINGS_SELECT_COLUMNS = [
  "player_id",
  "competition_id",
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

const TOURNAMENT_CATEGORIES_SELECT_COLUMNS = [
  "category_id",
  "name",
].join(", ");

export interface PlayersListFilters {
  seasonCode?: string;
}

interface PlayerReadAdapter {
  listPlayers(filters?: PlayersListFilters): Promise<PlayerDbRecord[]>;
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
  season_points: number | string | null;
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

interface RankedCompetitionResult {
  player_id: string;
  placement: number;
}

interface CompetitionHierarchyRow {
  competition_id: string;
  parent_id: string | null;
  record_type: string | null;
}

export interface PlayersRouteDependencies {
  listPlayers?: (filters?: PlayersListFilters) => Promise<Player[]>;
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
      throw new Error(`Failed to load competition hierarchy for player results: ${error.message}`);
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

function resolveSeasonPointsCompetitionIdForPlayerResult(
  competitionId: string,
  competitionsById: ReadonlyMap<string, CompetitionHierarchyRow>,
): string {
  const hierarchyCompetitionsById = new Map(
    [...competitionsById.entries()].map(([id, competition]) => [
      id,
      {
        competitionId: competition.competition_id,
        parentId: competition.parent_id,
        recordType: competition.record_type,
      },
    ]),
  );

  return resolveSeasonPointsCompetitionOwnerId(competitionId, hierarchyCompetitionsById);
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
    competitionsCount: record.competitions_count ?? 0,
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
      const { data: resultPairs, error: resultPairsError } = await supabase
        .schema(APP_PUBLIC_SCHEMA)
        .from("competition_results")
        .select(PLAYER_RESULT_COUNTS_SELECT_COLUMNS);

      if (resultPairsError) {
        throw new Error(
          `Failed to load player competition counts: ${resultPairsError.message}`,
        );
      }

      const competitionIdsByPlayerId = new Map<string, Set<string>>();

      for (const pair of (resultPairs ?? []) as unknown as Array<{
        player_id: string | null;
        competition_id: string | null;
      }>) {
        const playerId = pair.player_id?.trim();
        const competitionId = pair.competition_id?.trim();

        if (!playerId || !competitionId) {
          continue;
        }

        const competitionIds =
          competitionIdsByPlayerId.get(playerId) ?? new Set<string>();
        competitionIds.add(competitionId);
        competitionIdsByPlayerId.set(playerId, competitionIds);
      }

      let seasonPointsByPlayerId = new Map<string, number>();
      let seasonCompetitionCountByPlayerId = new Map<string, number>();

      if (filters.seasonCode) {
        const { data: seasonStandings, error: seasonStandingsError } = await supabase
          .schema(APP_PUBLIC_SCHEMA)
          .from("season_standings")
          .select(SEASON_STANDINGS_SELECT_COLUMNS)
          .eq("season_code", filters.seasonCode);

        if (seasonStandingsError && !isMissingSeasonStandingsTableError(seasonStandingsError)) {
          throw new Error(
            `Failed to load season standings for players list: ${seasonStandingsError.message}`,
          );
        }

        const aggregatedSeasonStandings = aggregateSeasonStandingsByPlayer(
          (seasonStandings ?? []) as unknown as SeasonStandingRow[],
        );
        seasonPointsByPlayerId = aggregatedSeasonStandings.seasonPointsByPlayerId;
        seasonCompetitionCountByPlayerId =
          aggregatedSeasonStandings.seasonCompetitionCountByPlayerId;
      }

      return players.map((player) => ({
        ...player,
        season_points: seasonPointsByPlayerId.get(player.player_id) ?? null,
        competitions_count: filters.seasonCode
          ? seasonCompetitionCountByPlayerId.get(player.player_id) ?? 0
          : competitionIdsByPlayerId.get(player.player_id)?.size ?? 0,
      }));
    },
    async listPlayerResults(filters) {
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

      let competitionsQuery = supabase
        .schema(APP_PUBLIC_SCHEMA)
        .from("competitions")
        .select(PLAYER_COMPETITIONS_SELECT_COLUMNS)
        .in("competition_id", competitionIds)
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

      const competitionsById = await loadCompetitionHierarchy([...visibleCompetitionIds]);

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
          .select(TOURNAMENT_CATEGORIES_SELECT_COLUMNS)
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
        .in("competition_id", [...visibleCompetitionIds]);

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

      let seasonPointsByCompetitionId = new Map<string, number>();
      if (filters.seasonCode) {
        const seasonPointsCompetitionIds = [
          ...new Set(
            [...visibleCompetitionIds].map((competitionId) =>
              resolveSeasonPointsCompetitionIdForPlayerResult(competitionId, competitionsById),
            ),
          ),
        ];

        const { data: seasonRows, error: seasonError } = await supabase
          .schema(APP_PUBLIC_SCHEMA)
          .from("season_standings")
          .select("competition_id, season_points")
          .eq("player_id", filters.playerId)
          .eq("season_code", filters.seasonCode)
          .in("competition_id", seasonPointsCompetitionIds);

        if (seasonError && !isMissingSeasonStandingsTableError(seasonError)) {
          throw new Error(
            `Failed to load season points for player results: ${seasonError.message}`,
          );
        }

        seasonPointsByCompetitionId = new Map(
          ((seasonRows ?? []) as Array<{ competition_id: string; season_points: number }>)
            .filter((row) => row.competition_id?.trim().length > 0)
            .map((row) => [row.competition_id.trim(), Number(row.season_points)]),
        );
      }

      const competitionById = new Map(
        competitionSummaries.map((competition) => [competition.competition_id, competition]),
      );

      return playerResultRows
        .filter((row) => visibleCompetitionIds.has(row.competition_id))
        .map((row) => {
          const competition = competitionById.get(row.competition_id);
          if (!competition) {
            return null;
          }

          const categoryId = competition.category_id?.trim() ?? "";
          const categoryName = categoryId.length > 0 ? (categoriesById.get(categoryId) ?? categoryId) : null;

          return {
            competitionId: competition.competition_id,
            competitionName: competition.competition_name,
            competitionDate: competition.competition_date,
            category: categoryName,
            placement: row.dnf
              ? null
              : (placementByCompetitionPlayerKey.get(
                  `${row.competition_id}:${filters.playerId}`,
                ) ?? null),
            sum: row.sum,
            dnf: row.dnf,
            seasonPoints:
              seasonPointsByCompetitionId.get(
                resolveSeasonPointsCompetitionIdForPlayerResult(
                  row.competition_id,
                  competitionsById,
                ),
              ) ?? null,
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
    },
  };
}

export function aggregateSeasonStandingsByPlayer(rows: SeasonStandingRow[]): {
  seasonPointsByPlayerId: Map<string, number>;
  seasonCompetitionCountByPlayerId: Map<string, number>;
} {
  const seasonPointsByPlayerId = new Map<string, number>();
  const competitionIdsByPlayerId = new Map<string, Set<string>>();

  for (const row of rows) {
    const playerId = row.player_id?.trim();
    const competitionId = row.competition_id?.trim();
    const seasonPoints = Number(row.season_points);

    if (!playerId) {
      continue;
    }

    if (Number.isFinite(seasonPoints)) {
      seasonPointsByPlayerId.set(
        playerId,
        (seasonPointsByPlayerId.get(playerId) ?? 0) + seasonPoints,
      );
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

  return {
    seasonPointsByPlayerId,
    seasonCompetitionCountByPlayerId,
  };
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

  return {
    playerId,
    seasonCode,
    dateFrom,
    dateTo,
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
        const filters = resolvePlayersListFilters(url);
        const players = await (dependencies.listPlayers ?? listPlayersFromRuntime)(
          filters,
        );

        sendSuccess(res, players, {
          count: players.length,
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
        });
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
