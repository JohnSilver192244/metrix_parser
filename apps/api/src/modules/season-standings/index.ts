import type {
  CompetitionCommentReasonCode,
  RunSeasonPointsAccrualRequest,
  RunSeasonPointsAccrualResult,
  SeasonStandingDbRecord,
} from "@metrix-parser/shared-types";
import {
  buildCompetitionComment,
  buildCompetitionChildrenByParentId,
  clearCompetitionCommentIfMatches,
  isCompetitionScoringUnitCandidate,
  normalizeCompetitionComment,
  resolveCompetitionResultSourceIds,
  shouldOverwriteCompetitionComment,
} from "@metrix-parser/shared-types";

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
const COMPETITION_RESULTS_PAGE_SIZE = 1000;

interface SeasonRecord {
  season_code: string;
  date_from: string;
  date_to: string;
  min_players: number;
}

interface CompetitionRecord {
  competition_id: string;
  category_id: string | null;
  comment?: string | null;
  parent_id: string | null;
  record_type: string | null;
  players_count: number | null;
}

interface CompetitionResultRecord {
  competition_id: string;
  player_id: string;
  sum: number | null;
  dnf: boolean;
}

interface CategoryRecord {
  category_id: string;
  coefficient: number;
}

interface SeasonPointsRecord {
  players_count: number;
  placement: number;
  points: number;
}

interface SeasonStandingsWriteAdapter {
  findSeasonByCode(seasonCode: string): Promise<SeasonRecord | null>;
  listCompetitionsInSeason(dateFrom: string, dateTo: string): Promise<CompetitionRecord[]>;
  listCompetitionResults(competitionIds: string[]): Promise<CompetitionResultRecord[]>;
  listCategoryCoefficients(categoryIds: string[]): Promise<CategoryRecord[]>;
  listSeasonPointsMatrix(seasonCode: string): Promise<SeasonPointsRecord[]>;
  listExistingCompetitionIds(
    seasonCode: string,
    competitionIds: string[],
  ): Promise<Set<string>>;
  updateCompetitionComment?(
    competitionId: string,
    comment: string | null,
  ): Promise<void>;
  upsertSeasonStandings(
    standings: SeasonStandingDbRecord[],
    overwriteExisting: boolean,
  ): Promise<number>;
}

type CompetitionResultsPageLoader = (
  from: number,
  to: number,
) => Promise<CompetitionResultRecord[]>;

export interface SeasonStandingsRouteDependencies {
  runSeasonPointsAccrual?: (
    payload: RunSeasonPointsAccrualRequest,
  ) => Promise<RunSeasonPointsAccrualResult>;
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

function parseRunSeasonPointsAccrualBody(body: unknown): RunSeasonPointsAccrualRequest {
  if (!body || typeof body !== "object") {
    throw new HttpError(400, "invalid_payload", "Request body must be a JSON object");
  }

  const overwriteExistingValue =
    "overwriteExisting" in body ? body.overwriteExisting : undefined;

  if (
    overwriteExistingValue !== undefined &&
    typeof overwriteExistingValue !== "boolean"
  ) {
    throw new HttpError(
      400,
      "invalid_overwriteExisting",
      "overwriteExisting must be a boolean when provided",
    );
  }

  return {
    seasonCode: normalizeRequiredString(
      "seasonCode" in body ? body.seasonCode : undefined,
      "seasonCode",
    ),
    overwriteExisting: overwriteExistingValue === true,
  };
}

function roundToTwo(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export async function loadPaginatedCompetitionResults(
  loadPage: CompetitionResultsPageLoader,
): Promise<CompetitionResultRecord[]> {
  const results: CompetitionResultRecord[] = [];
  let from = 0;

  while (true) {
    const to = from + COMPETITION_RESULTS_PAGE_SIZE - 1;
    const page = await loadPage(from, to);
    results.push(...page);

    if (page.length < COMPETITION_RESULTS_PAGE_SIZE) {
      break;
    }

    from += COMPETITION_RESULTS_PAGE_SIZE;
  }

  return results;
}

interface RankedCompetitionResult {
  player_id: string;
  placement: number;
}

interface SeasonScoringCompetitionUnit {
  competition_id: string;
  comment: string | null;
  category_id: string;
  source_competition_ids: string[];
  players_count: number | null;
}

interface RankedPlayerTotal {
  player_id: string;
  total_sum: number;
}

const SEASON_COMMENT_REASONS_TO_CLEAR: readonly CompetitionCommentReasonCode[] = [
  "automated_category_resolution_failed",
  "season_points_missing_coefficient",
  "season_points_insufficient_players",
  "season_points_missing_matrix",
  "season_points_existing_rows_skipped",
];

export function rankCompetitionResultsForSeasonPoints(
  results: readonly CompetitionResultRecord[],
  expectedCompetitionIds: readonly string[] = [],
): RankedCompetitionResult[] {
  const expectedIds = expectedCompetitionIds.length > 0
    ? new Set(expectedCompetitionIds)
    : new Set(
        results
          .map((result) => result.competition_id?.trim() ?? "")
          .filter((competitionId) => competitionId.length > 0),
      );
  const validExpectedIds = [...expectedIds];
  if (validExpectedIds.length === 0) {
    return [];
  }

  const resultsByPlayerId = new Map<string, Map<string, CompetitionResultRecord>>();

  for (const result of results) {
    const competitionId = result.competition_id?.trim() ?? "";
    if (!expectedIds.has(competitionId)) {
      continue;
    }

    const byCompetitionId = resultsByPlayerId.get(result.player_id) ?? new Map();
    byCompetitionId.set(competitionId, result);
    resultsByPlayerId.set(result.player_id, byCompetitionId);
  }

  const rankedPlayerTotals: RankedPlayerTotal[] = [];

  for (const [playerId, playerResultsByCompetitionId] of resultsByPlayerId) {
    if (playerResultsByCompetitionId.size !== validExpectedIds.length) {
      continue;
    }

    let totalSum = 0;
    let isEligible = true;

    for (const competitionId of validExpectedIds) {
      const result = playerResultsByCompetitionId.get(competitionId);
      if (!result || result.dnf || result.sum === null) {
        isEligible = false;
        break;
      }

      totalSum += result.sum;
    }

    if (!isEligible) {
      continue;
    }

    rankedPlayerTotals.push({
      player_id: playerId,
      total_sum: totalSum,
    });
  }

  const rankedResults = rankedPlayerTotals
    .sort((left, right) => {
      if (left.total_sum !== right.total_sum) {
        return left.total_sum - right.total_sum;
      }

      return left.player_id.localeCompare(right.player_id, "ru");
    });

  const placements: RankedCompetitionResult[] = [];
  let currentPlacement = 1;
  let index = 0;

  while (index < rankedResults.length) {
    const result = rankedResults[index];
    if (!result) {
      index += 1;
      continue;
    }

    let tieEndIndex = index + 1;
    while (tieEndIndex < rankedResults.length) {
      const nextResult = rankedResults[tieEndIndex];
      if (!nextResult || nextResult.total_sum !== result.total_sum) {
        break;
      }

      tieEndIndex += 1;
    }

    for (let tieIndex = index; tieIndex < tieEndIndex; tieIndex += 1) {
      const tiedResult = rankedResults[tieIndex];
      if (!tiedResult) {
        continue;
      }

      placements.push({
        player_id: tiedResult.player_id,
        placement: currentPlacement,
      });
    }

    currentPlacement += tieEndIndex - index;
    index = tieEndIndex;
  }

  return placements;
}

function resolveInheritedCategoryId(
  competitionId: string,
  competitionsById: ReadonlyMap<string, CompetitionRecord>,
): string | null {
  const visitedCompetitionIds = new Set<string>();
  let currentCompetitionId: string | null = competitionId;

  while (currentCompetitionId && !visitedCompetitionIds.has(currentCompetitionId)) {
    visitedCompetitionIds.add(currentCompetitionId);
    const competition: CompetitionRecord | null =
      competitionsById.get(currentCompetitionId) ?? null;
    if (!competition) {
      return null;
    }

    const categoryId = competition.category_id?.trim() ?? "";
    if (categoryId.length > 0) {
      return categoryId;
    }

    currentCompetitionId = competition.parent_id?.trim() ?? null;
  }

  return null;
}

export function buildSeasonScoringCompetitionUnits(
  competitions: readonly CompetitionRecord[],
): SeasonScoringCompetitionUnit[] {
  const competitionsById = new Map<string, CompetitionRecord>();
  const hierarchyCompetitions = competitions.map((competition) => ({
    competitionId: competition.competition_id,
    parentId: competition.parent_id ?? null,
    recordType: competition.record_type,
  }));
  const hierarchyCompetitionById = new Map(
    hierarchyCompetitions.map((competition) => [competition.competitionId, competition] as const),
  );
  const childrenByParentId = buildCompetitionChildrenByParentId(hierarchyCompetitions);

  for (const competition of competitions) {
    competitionsById.set(competition.competition_id, competition);
  }

  const units: SeasonScoringCompetitionUnit[] = [];

  for (const competition of competitions) {
    const hierarchyCompetition =
      hierarchyCompetitionById.get(competition.competition_id) ?? null;

    if (!hierarchyCompetition || !isCompetitionScoringUnitCandidate(hierarchyCompetition)) {
      continue;
    }

    const categoryId = resolveInheritedCategoryId(competition.competition_id, competitionsById);

    if (!categoryId) {
      continue;
    }

    units.push({
      competition_id: competition.competition_id,
      comment: normalizeCompetitionComment(competition.comment),
      category_id: categoryId,
      players_count: competition.players_count,
      source_competition_ids: resolveCompetitionResultSourceIds(
        hierarchyCompetition,
        childrenByParentId,
      ),
    });
  }

  return units;
}

export function resolveSeasonPointsPlayersCount(
  competitionPlayersCount: number | null,
  rankedResultsCount: number,
): number {
  const normalizedCompetitionPlayersCount =
    typeof competitionPlayersCount === "number" ? competitionPlayersCount : null;

  if (
    normalizedCompetitionPlayersCount !== null &&
    Number.isInteger(normalizedCompetitionPlayersCount) &&
    normalizedCompetitionPlayersCount > 0
  ) {
    return Math.max(normalizedCompetitionPlayersCount, rankedResultsCount);
  }

  return rankedResultsCount;
}

function createSupabaseSeasonStandingsWriteAdapter(): SeasonStandingsWriteAdapter {
  const supabase = createApiSupabaseAdminClient();

  return {
    async findSeasonByCode(seasonCode) {
      const { data, error } = await supabase
        .schema(APP_PUBLIC_SCHEMA)
        .from("seasons")
        .select("season_code, date_from, date_to, min_players")
        .eq("season_code", seasonCode)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to load season by code: ${error.message}`);
      }

      return (data as SeasonRecord | null) ?? null;
    },
    async listCompetitionsInSeason(dateFrom, dateTo) {
      const { data, error } = await supabase
        .schema(APP_PUBLIC_SCHEMA)
        .from("competitions")
        .select("competition_id, category_id, comment, parent_id, record_type, players_count")
        .gte("competition_date", dateFrom)
        .lte("competition_date", dateTo)
        .order("competition_date", { ascending: true });

      if (error) {
        throw new Error(`Failed to load season competitions: ${error.message}`);
      }

      return (data ?? []) as CompetitionRecord[];
    },
    async listCompetitionResults(competitionIds) {
      if (competitionIds.length === 0) {
        return [];
      }

      return loadPaginatedCompetitionResults(async (from, to) => {
        const { data, error } = await supabase
          .schema(APP_PUBLIC_SCHEMA)
          .from("competition_results")
          .select("competition_id, player_id, sum, dnf")
          .in("competition_id", competitionIds)
          .order("competition_id", { ascending: true })
          .order("sum", { ascending: true, nullsFirst: false })
          .order("player_id", { ascending: true })
          .range(from, to);

        if (error) {
          throw new Error(`Failed to load competition results for season: ${error.message}`);
        }

        return (data ?? []) as CompetitionResultRecord[];
      });
    },
    async listCategoryCoefficients(categoryIds) {
      if (categoryIds.length === 0) {
        return [];
      }

      const { data, error } = await supabase
        .schema(APP_PUBLIC_SCHEMA)
        .from("tournament_categories")
        .select("category_id, coefficient")
        .in("category_id", categoryIds);

      if (error) {
        throw new Error(`Failed to load tournament category coefficients: ${error.message}`);
      }

      return (data ?? []) as CategoryRecord[];
    },
    async listSeasonPointsMatrix(seasonCode) {
      const { data, error } = await supabase
        .schema(APP_PUBLIC_SCHEMA)
        .from("season_points_table")
        .select("players_count, placement, points")
        .eq("season_code", seasonCode);

      if (error) {
        throw new Error(`Failed to load season points matrix: ${error.message}`);
      }

      return (data ?? []) as SeasonPointsRecord[];
    },
    async listExistingCompetitionIds(seasonCode, competitionIds) {
      if (competitionIds.length === 0) {
        return new Set<string>();
      }

      const { data, error } = await supabase
        .schema(APP_PUBLIC_SCHEMA)
        .from("season_standings")
        .select("competition_id")
        .eq("season_code", seasonCode)
        .in("competition_id", competitionIds);

      if (error) {
        throw new Error(`Failed to load existing season standings: ${error.message}`);
      }

      return new Set(
        ((data ?? []) as Array<{ competition_id: string | null }>)
          .map((row) => row.competition_id?.trim() ?? "")
          .filter((competitionId) => competitionId.length > 0),
      );
    },
    async updateCompetitionComment(competitionId, comment) {
      const { error } = await supabase
        .schema(APP_PUBLIC_SCHEMA)
        .from("competitions")
        .update({
          comment: normalizeCompetitionComment(comment),
          updated_at: new Date().toISOString(),
        })
        .eq("competition_id", competitionId);

      if (error) {
        throw new Error(`Failed to update competition comment during season accrual: ${error.message}`);
      }
    },
    async upsertSeasonStandings(standings, overwriteExisting) {
      if (standings.length === 0) {
        return 0;
      }

      const { data, error } = await supabase
        .schema(APP_PUBLIC_SCHEMA)
        .from("season_standings")
        .upsert(standings, {
          onConflict: "season_code,competition_id,player_id",
          ignoreDuplicates: !overwriteExisting,
        })
        .select("id");

      if (error) {
        throw new Error(`Failed to save season standings: ${error.message}`);
      }

      return (data ?? []).length;
    },
  };
}

export async function runSeasonPointsAccrual(
  payload: RunSeasonPointsAccrualRequest,
  adapter: SeasonStandingsWriteAdapter,
): Promise<RunSeasonPointsAccrualResult> {
  const season = await adapter.findSeasonByCode(payload.seasonCode);

  if (!season) {
    throw new HttpError(404, "season_not_found", "Season not found");
  }

  const [pointsMatrix, competitionsInSeason] = await Promise.all([
    adapter.listSeasonPointsMatrix(payload.seasonCode),
    adapter.listCompetitionsInSeason(season.date_from, season.date_to),
  ]);

  const pointsByPlayersCountAndPlacement = new Map<string, number>();
  for (const entry of pointsMatrix) {
    pointsByPlayersCountAndPlacement.set(
      `${entry.players_count}:${entry.placement}`,
      Number(entry.points),
    );
  }

  const competitionsById = new Map(
    competitionsInSeason.map((competition) => [competition.competition_id, competition] as const),
  );
  const hierarchyCompetitions = competitionsInSeason.map((competition) => ({
    competitionId: competition.competition_id,
    parentId: competition.parent_id ?? null,
    recordType: competition.record_type,
  }));
  const hierarchyCompetitionById = new Map(
    hierarchyCompetitions.map((competition) => [competition.competitionId, competition] as const),
  );
  const missingCategoryCompetitions = competitionsInSeason.filter((competition) => {
    const hierarchyCompetition = hierarchyCompetitionById.get(competition.competition_id) ?? null;
    if (!hierarchyCompetition || !isCompetitionScoringUnitCandidate(hierarchyCompetition)) {
      return false;
    }

    return !resolveInheritedCategoryId(competition.competition_id, competitionsById);
  });
  const scoringUnits = buildSeasonScoringCompetitionUnits(competitionsInSeason);
  const competitionIds = [...new Set(
    scoringUnits.flatMap((unit) => unit.source_competition_ids),
  )];
  const categoryIds = [...new Set(
    scoringUnits.map((unit) => unit.category_id),
  )];

  const [results, categories, existingCompetitionIds] = await Promise.all([
    adapter.listCompetitionResults(competitionIds),
    adapter.listCategoryCoefficients(categoryIds),
    payload.overwriteExisting
      ? Promise.resolve(new Set<string>())
      : adapter.listExistingCompetitionIds(
          payload.seasonCode,
          scoringUnits.map((unit) => unit.competition_id),
        ),
  ]);

  const coefficientsByCategoryId = new Map<string, number>(
    categories.map((category) => [category.category_id, Number(category.coefficient)]),
  );

  const resultsByCompetitionId = new Map<string, CompetitionResultRecord[]>();
  for (const result of results) {
    const current = resultsByCompetitionId.get(result.competition_id) ?? [];
    current.push(result);
    resultsByCompetitionId.set(result.competition_id, current);
  }

  const timestamp = new Date().toISOString();
  const standingsToUpsert: SeasonStandingDbRecord[] = [];
  let competitionsEligible = 0;
  let competitionsSkippedByExisting = 0;
  let competitionsWithPoints = 0;

  for (const competition of missingCategoryCompetitions) {
    await reconcileSeasonCompetitionComment(
      adapter,
      {
        competition_id: competition.competition_id,
        comment: normalizeCompetitionComment(competition.comment),
      },
      "automated_category_resolution_failed",
    );
  }

  for (const competition of scoringUnits) {
    const categoryId = competition.category_id;
    const coefficient = coefficientsByCategoryId.get(categoryId);
    const resultsForCompetition = competition.source_competition_ids.flatMap(
      (sourceCompetitionId) => resultsByCompetitionId.get(sourceCompetitionId) ?? [],
    );
    const rankedResults = rankCompetitionResultsForSeasonPoints(
      resultsForCompetition,
      competition.source_competition_ids,
    );
    const participantsCount = resolveSeasonPointsPlayersCount(
      competition.players_count,
      rankedResults.length,
    );
    const hasExistingRows =
      !payload.overwriteExisting && existingCompetitionIds.has(competition.competition_id);
    const hasSeasonEvaluationInputs =
      coefficient == null || participantsCount < season.min_players || hasExistingRows || rankedResults.length > 0;

    let rowsForCompetition = 0;
    let nextCommentReason: CompetitionCommentReasonCode | null = null;

    if (coefficient == null) {
      nextCommentReason = "season_points_missing_coefficient";
    } else if (participantsCount < season.min_players) {
      nextCommentReason = "season_points_insufficient_players";
    } else {
      competitionsEligible += 1;

      if (hasExistingRows) {
        competitionsSkippedByExisting += 1;
        nextCommentReason = "season_points_existing_rows_skipped";
      } else if (rankedResults.length > 0) {
        for (const result of rankedResults) {
          const rawPoints = pointsByPlayersCountAndPlacement.get(
            `${participantsCount}:${result.placement}`,
          );

          if (rawPoints == null) {
            continue;
          }

          standingsToUpsert.push({
            season_code: payload.seasonCode,
            competition_id: competition.competition_id,
            player_id: result.player_id,
            category_id: categoryId,
            placement: result.placement,
            players_count: participantsCount,
            raw_points: rawPoints,
            coefficient,
            season_points: roundToTwo(rawPoints * coefficient),
            updated_at: timestamp,
          });
          rowsForCompetition += 1;
        }

        if (rowsForCompetition === 0) {
          nextCommentReason = "season_points_missing_matrix";
        }
      }
    }

    if (rowsForCompetition > 0) {
      competitionsWithPoints += 1;
    }

    if (hasSeasonEvaluationInputs) {
      await reconcileSeasonCompetitionComment(adapter, competition, nextCommentReason);
    }
  }

  const rowsPersisted = await adapter.upsertSeasonStandings(
    standingsToUpsert,
    payload.overwriteExisting === true,
  );

  return {
    seasonCode: payload.seasonCode,
    overwriteExisting: payload.overwriteExisting === true,
    competitionsInSeason: competitionsInSeason.length,
    competitionsEligible,
    competitionsSkippedByExisting,
    competitionsWithPoints,
    rowsPrepared: standingsToUpsert.length,
    rowsPersisted,
  };
}

function resolveSeasonCommentReasonForUnit(
  unit: SeasonScoringCompetitionUnit,
  season: SeasonRecord,
  coefficient: number | undefined,
  rankedResults: readonly RankedCompetitionResult[],
  participantsCount: number,
  hasExistingRows: boolean,
  rowsForCompetition: number,
): CompetitionCommentReasonCode | null {
  if (coefficient == null) {
    return "season_points_missing_coefficient";
  }

  if (participantsCount < season.min_players) {
    return "season_points_insufficient_players";
  }

  if (hasExistingRows) {
    return "season_points_existing_rows_skipped";
  }

  if (rankedResults.length > 0 && rowsForCompetition === 0) {
    return "season_points_missing_matrix";
  }

  return null;
}

async function reconcileSeasonCompetitionComment(
  adapter: SeasonStandingsWriteAdapter,
  competition: Pick<SeasonScoringCompetitionUnit, "competition_id" | "comment">,
  nextReason: CompetitionCommentReasonCode | null,
): Promise<void> {
  if (!adapter.updateCompetitionComment) {
    return;
  }

  const currentComment = normalizeCompetitionComment(competition.comment);

  if (nextReason) {
    if (!shouldOverwriteCompetitionComment(currentComment, nextReason)) {
      return;
    }

    await adapter.updateCompetitionComment(
      competition.competition_id,
      buildCompetitionComment(nextReason),
    );
    return;
  }

  const clearedComment = clearCompetitionCommentIfMatches(
    currentComment,
    SEASON_COMMENT_REASONS_TO_CLEAR,
  );

  if (clearedComment !== currentComment) {
    await adapter.updateCompetitionComment(competition.competition_id, clearedComment);
  }
}

async function runSeasonPointsAccrualFromRuntime(
  payload: RunSeasonPointsAccrualRequest,
): Promise<RunSeasonPointsAccrualResult> {
  return runSeasonPointsAccrual(payload, createSupabaseSeasonStandingsWriteAdapter());
}

export function getSeasonStandingsRoutes(
  dependencies: SeasonStandingsRouteDependencies = {},
  authDependencies: AuthGuardDependencies = {},
): RouteDefinition[] {
  return [
    {
      method: "POST",
      path: "/season-standings/accrual",
      handler: async ({ req, res }) => {
        await requireAuthenticatedUser(readSessionToken(req), authDependencies);

        const body = await readJsonBody<RunSeasonPointsAccrualRequest>(req);
        const payload = parseRunSeasonPointsAccrualBody(body);
        const result = await (
          dependencies.runSeasonPointsAccrual ?? runSeasonPointsAccrualFromRuntime
        )(payload);

        sendSuccess(res, result);
      },
    },
  ];
}
