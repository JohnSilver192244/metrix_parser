import type {
  CompetitionContextResponse,
  CompetitionCommentReasonCode,
  Competition,
  CompetitionHierarchyNode,
  CompetitionDbRecord,
  UpdateCompetitionCategoryRequest,
} from "@metrix-parser/shared-types";
import {
  buildCompetitionChildrenByParentId,
  buildCompetitionComment,
  clearCompetitionCommentIfMatches,
  normalizeCompetitionComment,
  resolveCompetitionIdentityById,
  resolveCompetitionResultSourceIds,
  shouldOverwriteCompetitionComment,
} from "@metrix-parser/shared-types";

import { readJsonBody, sendSuccess } from "../../lib/http";
import { HttpError } from "../../lib/http-errors";
import { resolveListPagination } from "../../lib/pagination";
import { invalidateApiReadCacheAll } from "../../lib/api-read-cache";
import { createApiSupabaseAdminClient } from "../../lib/supabase-admin";
import type { RouteDefinition } from "../../lib/router";
import {
  readSessionToken,
  requireAuthenticatedUser,
  type AuthGuardDependencies,
} from "../auth/runtime";

const APP_PUBLIC_SCHEMA = "app_public";
const COMPETITION_RESULTS_PAGE_SIZE = 1000;
const SEASON_STANDINGS_COMPETITION_IDS_CHUNK_SIZE = 200;
const COMPETITIONS_SELECT_COLUMNS = [
  "competition_id",
  "competition_name",
  "competition_date",
  "parent_id",
  "course_id",
  "course_name",
  "category_id",
  "comment",
  "record_type",
  "players_count",
  "metrix_id",
].join(", ");
const COMPETITIONS_SELECT_COLUMNS_LEGACY = [
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
const COMPETITIONS_SELECT_COLUMNS_WITHOUT_COMMENT = [
  "competition_id",
  "competition_name",
  "competition_date",
  "parent_id",
  "course_id",
  "course_name",
  "category_id",
  "record_type",
  "players_count",
  "metrix_id",
].join(", ");

interface SupabaseQueryError {
  code?: string;
  message: string;
}

interface SeasonStandingCompetitionRow {
  competition_id: string | null;
  season_code?: string | null;
  player_id?: string | null;
  season_points: number | string | null;
}

interface CompetitionReadModelRow {
  competition_id: string;
  has_results: boolean | null;
  season_points: number | string | null;
}

interface CompetitionReadAdapter {
  listCompetitions(): Promise<CompetitionDbRecord[]>;
}

interface CompetitionWriteAdapter {
  updateCompetitionCategory(
    payload: UpdateCompetitionCategoryRequest,
  ): Promise<CompetitionDbRecord>;
  getCompetitionComment(competitionId: string): Promise<string | null>;
  updateCompetitionComment(
    competitionId: string,
    comment: string | null,
  ): Promise<void>;
}

export interface CompetitionsRouteDependencies {
  listCompetitions?: () => Promise<Competition[]>;
  getCompetitionContext?: (
    competitionId: string,
  ) => Promise<CompetitionContextResponse | null>;
  updateCompetitionCategory?: (
    payload: UpdateCompetitionCategoryRequest,
  ) => Promise<Competition>;
  getCompetitionComment?: (competitionId: string) => Promise<string | null>;
  updateCompetitionComment?: (
    competitionId: string,
    comment: string | null,
  ) => Promise<void>;
}

async function fetchCompetitionRowsWithFallback(
  supabase: ReturnType<typeof createApiSupabaseAdminClient>,
  queryFactory: (selectColumns: string) => Promise<{ data: unknown; error: SupabaseQueryError | null }>,
): Promise<CompetitionDbRecord[]> {
  let { data, error } = await queryFactory(COMPETITIONS_SELECT_COLUMNS);
  const fallbackSelectColumns = resolveLegacyFallbackCompetitionSelectColumns(error);

  if (fallbackSelectColumns) {
    const legacyResponse = await queryFactory(fallbackSelectColumns);
    data = legacyResponse.data;
    error = legacyResponse.error;
  }

  if (error) {
    throw new Error(`Failed to load competitions context: ${error.message}`);
  }

  return (data ?? []) as CompetitionDbRecord[];
}

async function loadCompetitionRowsByIds(
  supabase: ReturnType<typeof createApiSupabaseAdminClient>,
  competitionIds: readonly string[],
): Promise<CompetitionDbRecord[]> {
  if (competitionIds.length === 0) {
    return [];
  }

  return fetchCompetitionRowsWithFallback(supabase, async (selectColumns) => {
    const response = await supabase
      .schema(APP_PUBLIC_SCHEMA)
      .from("competitions")
      .select(selectColumns)
      .in("competition_id", competitionIds);

    return {
      data: response.data,
      error: response.error,
    };
  });
}

async function loadCompetitionRowsByParentIds(
  supabase: ReturnType<typeof createApiSupabaseAdminClient>,
  parentIds: readonly string[],
): Promise<CompetitionDbRecord[]> {
  if (parentIds.length === 0) {
    return [];
  }

  return fetchCompetitionRowsWithFallback(supabase, async (selectColumns) => {
    const response = await supabase
      .schema(APP_PUBLIC_SCHEMA)
      .from("competitions")
      .select(selectColumns)
      .in("parent_id", parentIds);

    return {
      data: response.data,
      error: response.error,
    };
  });
}

function toCompetition(record: CompetitionDbRecord): Competition {
  return {
    competitionId: record.competition_id,
    competitionName: record.competition_name,
    competitionDate: record.competition_date,
    parentId: record.parent_id ?? null,
    courseId: record.course_id,
    courseName: record.course_name,
    categoryId: record.category_id ?? null,
    comment: normalizeCompetitionComment(record.comment),
    recordType: record.record_type,
    playersCount: record.players_count,
    metrixId: record.metrix_id,
    hasResults: record.has_results ?? false,
    seasonPoints: record.season_points ?? null,
  };
}

export function resolveCompetitionIdsWithResultsIncludingDescendants(
  records: readonly CompetitionDbRecord[],
  directCompetitionIdsWithResults: ReadonlySet<string>,
): Set<string> {
  const hierarchyNodes = records.map(
    (record) =>
      ({
        competitionId: record.competition_id,
        parentId: record.parent_id ?? null,
        recordType: record.record_type,
      }) satisfies CompetitionHierarchyNode,
  );
  const competitionsById = new Map(
    hierarchyNodes.map((node) => [node.competitionId, node]),
  );
  const childrenByParentId = buildCompetitionChildrenByParentId(hierarchyNodes);
  const competitionIdsWithResults = new Set<string>();
  const parentIdByCompetitionId = new Map(
    hierarchyNodes.map((node) => [node.competitionId, node.parentId ?? null]),
  );
  for (const node of hierarchyNodes) {
    const identity = resolveCompetitionIdentityById(
      node.competitionId,
      competitionsById,
      childrenByParentId,
    );
    if (
      identity.resultSourceCompetitionIds.some((sourceCompetitionId) =>
        directCompetitionIdsWithResults.has(sourceCompetitionId),
      )
    ) {
      let currentCompetitionId: string | null = node.competitionId;
      const visitedCompetitionIds = new Set<string>();
      while (currentCompetitionId && !visitedCompetitionIds.has(currentCompetitionId)) {
        visitedCompetitionIds.add(currentCompetitionId);
        competitionIdsWithResults.add(currentCompetitionId);
        currentCompetitionId = parentIdByCompetitionId.get(currentCompetitionId) ?? null;
      }
    }
  }

  return competitionIdsWithResults;
}

async function listCompetitionIdsWithResults(): Promise<Set<string>> {
  const supabase = createApiSupabaseAdminClient();
  const competitionIdsWithResults = new Set<string>();
  let from = 0;

  while (true) {
    const to = from + COMPETITION_RESULTS_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .schema(APP_PUBLIC_SCHEMA)
      .from("competition_results")
      .select("competition_id")
      .range(from, to);

    if (error) {
      throw new Error(`Failed to load competitions with results: ${error.message}`);
    }

    const rows = (data ?? []) as Array<{ competition_id: string | null }>;
    for (const row of rows) {
      const competitionId = row.competition_id?.trim();
      if (competitionId) {
        competitionIdsWithResults.add(competitionId);
      }
    }

    if (rows.length < COMPETITION_RESULTS_PAGE_SIZE) {
      break;
    }

    from += COMPETITION_RESULTS_PAGE_SIZE;
  }

  return competitionIdsWithResults;
}

export function aggregateSeasonStandingsByCompetition(
  rows: readonly SeasonStandingCompetitionRow[],
): Map<string, number> {
  const totalsByCompetitionAndSeason = new Map<string, number>();
  const playersByCompetitionAndSeason = new Map<string, Set<string>>();

  for (const row of rows) {
    const competitionId = row.competition_id?.trim();
    if (!competitionId) {
      continue;
    }

    const seasonPoints = Number(row.season_points);
    if (!Number.isFinite(seasonPoints)) {
      continue;
    }

    const seasonCode = row.season_code?.trim() ?? "";
    const key = `${competitionId}::${seasonCode}`;
    totalsByCompetitionAndSeason.set(
      key,
      (totalsByCompetitionAndSeason.get(key) ?? 0) + seasonPoints,
    );

    const playerId = row.player_id?.trim() ?? "";
    if (playerId.length > 0) {
      const players = playersByCompetitionAndSeason.get(key) ?? new Set<string>();
      players.add(playerId);
      playersByCompetitionAndSeason.set(key, players);
    }
  }

  const seasonPointsByCompetitionId = new Map<
    string,
    { seasonCode: string; total: number; playersCount: number }
  >();
  for (const [key, total] of totalsByCompetitionAndSeason.entries()) {
    const [competitionId, seasonCode = ""] = key.split("::");
    if (!competitionId) {
      continue;
    }

    const playersCount = playersByCompetitionAndSeason.get(key)?.size ?? 0;
    const current = seasonPointsByCompetitionId.get(competitionId);
    if (
      !current ||
      playersCount > current.playersCount ||
      (playersCount === current.playersCount &&
        seasonCode.localeCompare(current.seasonCode, "ru") > 0)
    ) {
      seasonPointsByCompetitionId.set(competitionId, { seasonCode, total, playersCount });
    }
  }

  const totalsByCompetitionId = new Map<string, number>();
  for (const [competitionId, value] of seasonPointsByCompetitionId.entries()) {
    totalsByCompetitionId.set(competitionId, value.total);
  }

  return totalsByCompetitionId;
}

function chunkCompetitionIds(
  competitionIds: readonly string[],
  chunkSize: number,
): string[][] {
  const chunks: string[][] = [];

  for (let index = 0; index < competitionIds.length; index += chunkSize) {
    chunks.push(competitionIds.slice(index, index + chunkSize));
  }

  return chunks;
}

export async function loadPaginatedSeasonStandingsRows(
  loadPage: (from: number, to: number) => Promise<SeasonStandingCompetitionRow[]>,
  pageSize: number = COMPETITION_RESULTS_PAGE_SIZE,
): Promise<SeasonStandingCompetitionRow[]> {
  const rows: SeasonStandingCompetitionRow[] = [];
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

function buildCompetitionIdentityMaps(records: readonly CompetitionDbRecord[]): {
  competitionsById: Map<string, CompetitionHierarchyNode>;
  childrenByParentId: Map<string, CompetitionHierarchyNode[]>;
} {
  const hierarchyNodes = records.map(
    (record) =>
      ({
        competitionId: record.competition_id,
        parentId: record.parent_id ?? null,
        recordType: record.record_type,
      }) satisfies CompetitionHierarchyNode,
  );

  return {
    competitionsById: new Map(hierarchyNodes.map((node) => [node.competitionId, node])),
    childrenByParentId: buildCompetitionChildrenByParentId(hierarchyNodes),
  };
}

export function resolveCompetitionSeasonPointsByCompetitionId(
  records: readonly CompetitionDbRecord[],
  seasonPointsByOwnerCompetitionId: ReadonlyMap<string, number>,
): Map<string, number | null> {
  const { competitionsById, childrenByParentId } = buildCompetitionIdentityMaps(records);
  const seasonPointsByCompetitionId = new Map<string, number | null>();

  for (const record of records) {
    const identity = resolveCompetitionIdentityById(
      record.competition_id,
      competitionsById,
      childrenByParentId,
    );

    seasonPointsByCompetitionId.set(
      record.competition_id,
      seasonPointsByOwnerCompetitionId.get(identity.ownerCompetitionId) ?? null,
    );
  }

  return seasonPointsByCompetitionId;
}

function isMissingSeasonStandingsTableError(error: SupabaseQueryError | null): boolean {
  return error?.code === "42P01" && error.message.includes("season_standings");
}

function isMissingCompetitionReadModelTableError(error: SupabaseQueryError | null): boolean {
  if (!error) {
    return false;
  }

  if (error.code === "42P01" && error.message.includes("competition_read_model")) {
    return true;
  }

  return (
    error.code?.startsWith("PGRST") === true &&
    error.message.toLowerCase().includes("competition_read_model")
  );
}

async function loadCompetitionReadModelByCompetitionId(
  competitionIds: readonly string[],
): Promise<Map<string, { hasResults: boolean; seasonPoints: number | null }> | null> {
  if (competitionIds.length === 0) {
    return new Map();
  }

  const supabase = createApiSupabaseAdminClient();
  const { data, error } = await supabase
    .schema(APP_PUBLIC_SCHEMA)
    .from("competition_read_model")
    .select("competition_id, has_results, season_points")
    .in("competition_id", competitionIds);

  if (error) {
    if (isMissingCompetitionReadModelTableError(error)) {
      return null;
    }

    throw new Error(`Failed to load competition read model: ${error.message}`);
  }

  return new Map(
    ((data ?? []) as CompetitionReadModelRow[]).map((row) => [
      row.competition_id,
      {
        hasResults: row.has_results === true,
        seasonPoints:
          row.season_points == null
            ? null
            : Number.isFinite(Number(row.season_points))
              ? Number(row.season_points)
              : null,
      },
    ]),
  );
}

async function listSeasonPointsByCompetition(
  competitionIds: readonly string[],
): Promise<Map<string, number>> {
  if (competitionIds.length === 0) {
    return new Map();
  }

  const normalizedCompetitionIds = [...new Set(
    competitionIds.map((competitionId) => competitionId.trim()).filter(Boolean),
  )];
  if (normalizedCompetitionIds.length === 0) {
    return new Map();
  }

  const supabase = createApiSupabaseAdminClient();
  const seasonStandingRows: SeasonStandingCompetitionRow[] = [];
  const idChunks = chunkCompetitionIds(
    normalizedCompetitionIds,
    SEASON_STANDINGS_COMPETITION_IDS_CHUNK_SIZE,
  );

  for (const idChunk of idChunks) {
    const chunkRows = await loadPaginatedSeasonStandingsRows(async (from, to) => {
      const { data, error } = await supabase
        .schema(APP_PUBLIC_SCHEMA)
        .from("season_standings")
        .select("competition_id, season_code, player_id, season_points")
        .in("competition_id", idChunk)
        .range(from, to);

      if (error) {
        if (isMissingSeasonStandingsTableError(error)) {
          return [];
        }

        throw new Error(`Failed to load season points for competitions list: ${error.message}`);
      }

      return (data ?? []) as SeasonStandingCompetitionRow[];
    });
    seasonStandingRows.push(...chunkRows);
  }

  return aggregateSeasonStandingsByCompetition(seasonStandingRows);
}

function createSupabaseCompetitionReadAdapter(): CompetitionReadAdapter {
  const supabase = createApiSupabaseAdminClient();

  return {
    async listCompetitions() {
      let { data, error } = await supabase
        .schema(APP_PUBLIC_SCHEMA)
        .from("competitions")
        .select(COMPETITIONS_SELECT_COLUMNS)
        .order("competition_date", { ascending: false })
        .order("competition_name", { ascending: true });

      const fallbackSelectColumns =
        resolveLegacyFallbackCompetitionSelectColumns(error);
      if (fallbackSelectColumns) {
        const legacyResponse = await supabase
          .schema(APP_PUBLIC_SCHEMA)
          .from("competitions")
          .select(fallbackSelectColumns)
          .order("competition_date", { ascending: false })
          .order("competition_name", { ascending: true });

        data = legacyResponse.data;
        error = legacyResponse.error;
      }

      if (error) {
        throw new Error(`Failed to load competitions list: ${error.message}`);
      }

      return (data ?? []) as unknown as CompetitionDbRecord[];
    },
  };
}

function isMissingLegacyCompatibleCompetitionColumnError(
  error: SupabaseQueryError | null,
): boolean {
  if (error?.code !== "42703") {
    return false;
  }

  return error.message.includes("category_id") || error.message.includes("comment");
}

export function resolveLegacyFallbackCompetitionSelectColumns(
  error: SupabaseQueryError | null,
): string | null {
  if (!isMissingLegacyCompatibleCompetitionColumnError(error)) {
    return null;
  }

  if (error?.message.includes("comment")) {
    return COMPETITIONS_SELECT_COLUMNS_WITHOUT_COMMENT;
  }

  return COMPETITIONS_SELECT_COLUMNS_LEGACY;
}

function createSupabaseCompetitionWriteAdapter(): CompetitionWriteAdapter {
  const supabase = createApiSupabaseAdminClient();

  return {
    async updateCompetitionCategory(payload) {
      const { data, error } = await supabase
        .schema(APP_PUBLIC_SCHEMA)
        .from("competitions")
        .update({
          category_id: payload.categoryId,
          updated_at: new Date().toISOString(),
        })
        .eq("competition_id", payload.competitionId)
        .select(COMPETITIONS_SELECT_COLUMNS)
        .single();

      if (error) {
        throw new Error(`Failed to update competition category: ${error.message}`);
      }

      return data as unknown as CompetitionDbRecord;
    },
    async getCompetitionComment(competitionId) {
      const { data, error } = await supabase
        .schema(APP_PUBLIC_SCHEMA)
        .from("competitions")
        .select("comment")
        .eq("competition_id", competitionId)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to load competition comment: ${error.message}`);
      }

      return normalizeCompetitionComment((data as { comment?: string | null } | null)?.comment);
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
        throw new Error(`Failed to update competition comment: ${error.message}`);
      }
    },
  };
}

async function listCompetitionsFromRuntime(): Promise<Competition[]> {
  const adapter = createSupabaseCompetitionReadAdapter();
  const records = await adapter.listCompetitions();
  const competitionIds = records.map((record) => record.competition_id);
  const competitionReadModelByCompetitionId =
    await loadCompetitionReadModelByCompetitionId(competitionIds);
  const directCompetitionIdsWithResults =
    competitionReadModelByCompetitionId
      ? new Set(
          [...competitionReadModelByCompetitionId.entries()]
            .filter(([, row]) => row.hasResults)
            .map(([competitionId]) => competitionId),
        )
      : await listCompetitionIdsWithResults();
  const seasonPointsByOwnerCompetitionId =
    competitionReadModelByCompetitionId
      ? new Map(
          [...competitionReadModelByCompetitionId.entries()]
            .filter(([, row]) => row.seasonPoints !== null)
            .map(([competitionId, row]) => [competitionId, row.seasonPoints as number]),
        )
      : await listSeasonPointsByCompetition(competitionIds);
  const seasonPointsByCompetitionId = resolveCompetitionSeasonPointsByCompetitionId(
    records,
    seasonPointsByOwnerCompetitionId,
  );
  const competitionIdsWithResults = resolveCompetitionIdsWithResultsIncludingDescendants(
    records,
    directCompetitionIdsWithResults,
  );

  return records.map((record) =>
    toCompetition({
      ...record,
      has_results: competitionIdsWithResults.has(record.competition_id),
      season_points: seasonPointsByCompetitionId.get(record.competition_id) ?? null,
    }),
  );
}

async function getCompetitionContextFromRuntime(
  competitionId: string,
): Promise<CompetitionContextResponse | null> {
  const normalizedCompetitionId = competitionId.trim();
  if (normalizedCompetitionId.length === 0) {
    return null;
  }

  const supabase = createApiSupabaseAdminClient();
  const competitionRowsById = new Map<string, CompetitionDbRecord>();

  let pendingAncestorIds = [normalizedCompetitionId];
  while (pendingAncestorIds.length > 0) {
    const rows = await loadCompetitionRowsByIds(supabase, pendingAncestorIds);
    for (const row of rows) {
      competitionRowsById.set(row.competition_id, row);
    }

    pendingAncestorIds = [
      ...new Set(
        rows
          .map((row) => row.parent_id?.trim() ?? "")
          .filter((parentId) => parentId.length > 0)
          .filter((parentId) => !competitionRowsById.has(parentId)),
      ),
    ];
  }

  if (!competitionRowsById.has(normalizedCompetitionId)) {
    return null;
  }

  let pendingParentIds = [normalizedCompetitionId];
  while (pendingParentIds.length > 0) {
    const childRows = await loadCompetitionRowsByParentIds(supabase, pendingParentIds);
    const nextParentIds: string[] = [];

    for (const row of childRows) {
      if (competitionRowsById.has(row.competition_id)) {
        continue;
      }

      competitionRowsById.set(row.competition_id, row);
      nextParentIds.push(row.competition_id);
    }

    pendingParentIds = nextParentIds;
  }

  const hierarchyRecords = [...competitionRowsById.values()];
  const hierarchyNodes = hierarchyRecords.map(
    (record) =>
      ({
        competitionId: record.competition_id,
        parentId: record.parent_id ?? null,
        recordType: record.record_type,
      }) satisfies CompetitionHierarchyNode,
  );
  const childrenByParentId = buildCompetitionChildrenByParentId(hierarchyNodes);
  const selectedNode = hierarchyNodes.find((node) => node.competitionId === normalizedCompetitionId);
  const resultCompetitionIds = selectedNode
    ? resolveCompetitionResultSourceIds(selectedNode, childrenByParentId)
    : [normalizedCompetitionId];

  const courseIds = [
    ...new Set(
      hierarchyRecords
        .map((record) => record.course_id?.trim() ?? "")
        .filter((courseId) => courseId.length > 0),
    ),
  ];
  const categoryIds = [
    ...new Set(
      hierarchyRecords
        .map((record) => record.category_id?.trim() ?? "")
        .filter((categoryId) => categoryId.length > 0),
    ),
  ];

  const courseNamesById: Record<string, string> = {};
  if (courseIds.length > 0) {
    const { data: courseRows, error: coursesError } = await supabase
      .schema(APP_PUBLIC_SCHEMA)
      .from("courses")
      .select("course_id, name")
      .in("course_id", courseIds);

    if (coursesError) {
      throw new Error(`Failed to load course labels for competitions context: ${coursesError.message}`);
    }

    for (const row of (courseRows ?? []) as Array<{ course_id: string; name: string }>) {
      courseNamesById[row.course_id] = row.name;
    }
  }

  const categoryNamesById: Record<string, string> = {};
  if (categoryIds.length > 0) {
    const { data: categoryRows, error: categoriesError } = await supabase
      .schema(APP_PUBLIC_SCHEMA)
      .from("tournament_categories")
      .select("category_id, name")
      .in("category_id", categoryIds);

    if (categoriesError) {
      throw new Error(
        `Failed to load category labels for competitions context: ${categoriesError.message}`,
      );
    }

    for (const row of (categoryRows ?? []) as Array<{ category_id: string; name: string }>) {
      categoryNamesById[row.category_id] = row.name;
    }
  }

  const selectedRecord = competitionRowsById.get(normalizedCompetitionId);
  if (!selectedRecord) {
    return null;
  }

  return {
    competition: toCompetition(selectedRecord),
    hierarchy: hierarchyRecords.map((record) => toCompetition(record)),
    courseNamesById,
    categoryNamesById,
    resultCompetitionIds,
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

function normalizeOptionalString(value: unknown, fieldName: string): string | null {
  if (value == null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new HttpError(400, `invalid_${fieldName}`, `${fieldName} must be a string or null`);
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function parseUpdateCompetitionCategoryRequestBody(
  body: unknown,
): UpdateCompetitionCategoryRequest {
  if (!body || typeof body !== "object") {
    throw new HttpError(400, "invalid_payload", "Request body must be a JSON object");
  }

  return {
    competitionId: normalizeRequiredString(
      "competitionId" in body ? body.competitionId : undefined,
      "competitionId",
    ),
    categoryId: normalizeOptionalString(
      "categoryId" in body ? body.categoryId : undefined,
      "categoryId",
    ),
  };
}

async function updateCompetitionCategoryFromRuntime(
  payload: UpdateCompetitionCategoryRequest,
): Promise<Competition> {
  const adapter = createSupabaseCompetitionWriteAdapter();
  const readAdapter = createSupabaseCompetitionReadAdapter();
  const [record, records] = await Promise.all([
    adapter.updateCompetitionCategory(payload),
    readAdapter.listCompetitions(),
  ]);
  const competitionIds = records.map((competitionRecord) => competitionRecord.competition_id);
  const competitionReadModelByCompetitionId =
    await loadCompetitionReadModelByCompetitionId(competitionIds);
  const directCompetitionIdsWithResults =
    competitionReadModelByCompetitionId
      ? new Set(
          [...competitionReadModelByCompetitionId.entries()]
            .filter(([, row]) => row.hasResults)
            .map(([competitionId]) => competitionId),
        )
      : await listCompetitionIdsWithResults();
  const seasonPointsByOwnerCompetitionId =
    competitionReadModelByCompetitionId
      ? new Map(
          [...competitionReadModelByCompetitionId.entries()]
            .filter(([, row]) => row.seasonPoints !== null)
            .map(([competitionId, row]) => [competitionId, row.seasonPoints as number]),
        )
      : await listSeasonPointsByCompetition(competitionIds);
  const competitionIdsWithResults = resolveCompetitionIdsWithResultsIncludingDescendants(
    records,
    directCompetitionIdsWithResults,
  );
  const seasonPointsByCompetitionId = resolveCompetitionSeasonPointsByCompetitionId(
    records,
    seasonPointsByOwnerCompetitionId,
  );

  return toCompetition({
    ...record,
    has_results: competitionIdsWithResults.has(record.competition_id),
    season_points: seasonPointsByCompetitionId.get(record.competition_id) ?? null,
  });
}

function resolveManualCategoryFailureComment(): string {
  return buildCompetitionComment("manual_category_update_failed");
}

async function setCompetitionCommentIfAllowed(
  competitionId: string,
  currentComment: string | null,
  candidateReason: CompetitionCommentReasonCode,
  updateCompetitionComment: (
    competitionId: string,
    comment: string | null,
  ) => Promise<void>,
): Promise<void> {
  if (!shouldOverwriteCompetitionComment(currentComment, candidateReason)) {
    return;
  }

  await updateCompetitionComment(competitionId, buildCompetitionComment(candidateReason));
}

export function getCompetitionsRoutes(
  dependencies: CompetitionsRouteDependencies = {},
  authDependencies: AuthGuardDependencies = {},
): RouteDefinition[] {
  return [
    {
      method: "GET",
      path: "/competitions",
      handler: async ({ res, url }) => {
        const pagination = resolveListPagination(url);
        const allCompetitions =
          await (dependencies.listCompetitions ?? listCompetitionsFromRuntime)();
        const competitions = allCompetitions.slice(
          pagination.offset,
          pagination.offset + pagination.limit,
        );

        sendSuccess(res, competitions, {
          count: allCompetitions.length,
          limit: pagination.limit,
          offset: pagination.offset,
        });
      },
    },
    {
      method: "GET",
      path: "/competitions/:competitionId/context",
      handler: async ({ res, params }) => {
        const competitionId = params.competitionId?.trim();
        if (!competitionId) {
          throw new HttpError(
            400,
            "invalid_competition_id",
            "competitionId path parameter is required",
          );
        }

        const context = await (
          dependencies.getCompetitionContext ?? getCompetitionContextFromRuntime
        )(competitionId);

        if (!context) {
          throw new HttpError(404, "not_found", "Competition not found");
        }

        sendSuccess(res, context);
      },
    },
    {
      method: "PUT",
      path: "/competitions/category",
      handler: async ({ req, res }) => {
        await requireAuthenticatedUser(readSessionToken(req), authDependencies);

        const body = await readJsonBody<UpdateCompetitionCategoryRequest>(req);
        const payload = parseUpdateCompetitionCategoryRequestBody(body);
        const updateCompetitionCategory =
          dependencies.updateCompetitionCategory ?? updateCompetitionCategoryFromRuntime;
        const getCompetitionComment =
          dependencies.getCompetitionComment ??
          ((competitionId: string) =>
            createSupabaseCompetitionWriteAdapter().getCompetitionComment(competitionId));
        const updateCompetitionComment =
          dependencies.updateCompetitionComment ??
          ((competitionId: string, comment: string | null) =>
            createSupabaseCompetitionWriteAdapter().updateCompetitionComment(
              competitionId,
              comment,
            ));

        try {
          const competition = await updateCompetitionCategory(payload);
          const nextComment = clearCompetitionCommentIfMatches(competition.comment, [
            "manual_category_update_failed",
          ]);

          if (nextComment !== normalizeCompetitionComment(competition.comment)) {
            await updateCompetitionComment(payload.competitionId, nextComment);
          }

          const nextCompetition =
            nextComment === normalizeCompetitionComment(competition.comment)
              ? competition
              : {
                  ...competition,
                  comment: nextComment,
                };

          invalidateApiReadCacheAll();
          sendSuccess(res, nextCompetition);
          return;
        } catch (error) {
          try {
            const currentComment = await getCompetitionComment(payload.competitionId);
            await setCompetitionCommentIfAllowed(
              payload.competitionId,
              currentComment,
              "manual_category_update_failed",
              updateCompetitionComment,
            );
          } catch {
            // Preserve the original category update error if comment reconciliation fails.
          }

          throw error;
        }

      },
    },
  ];
}
