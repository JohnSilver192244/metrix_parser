import type {
  CompetitionCommentReasonCode,
  Competition,
  CompetitionDbRecord,
  UpdateCompetitionCategoryRequest,
} from "@metrix-parser/shared-types";
import {
  buildCompetitionComment,
  clearCompetitionCommentIfMatches,
  normalizeCompetitionComment,
  shouldOverwriteCompetitionComment,
} from "@metrix-parser/shared-types";

import { readJsonBody, sendSuccess } from "../../lib/http";
import { HttpError } from "../../lib/http-errors";
import { createApiSupabaseAdminClient } from "../../lib/supabase-admin";
import type { RouteDefinition } from "../../lib/router";
import {
  readSessionToken,
  requireAuthenticatedUser,
  type AuthGuardDependencies,
} from "../auth/runtime";

const APP_PUBLIC_SCHEMA = "app_public";
const COMPETITION_RESULTS_PAGE_SIZE = 1000;
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

interface SupabaseQueryError {
  code?: string;
  message: string;
}

interface SeasonStandingCompetitionRow {
  competition_id: string | null;
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
  updateCompetitionCategory?: (
    payload: UpdateCompetitionCategoryRequest,
  ) => Promise<Competition>;
  getCompetitionComment?: (competitionId: string) => Promise<string | null>;
  updateCompetitionComment?: (
    competitionId: string,
    comment: string | null,
  ) => Promise<void>;
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
  const parentIdByCompetitionId = new Map<string, string | null>();
  for (const record of records) {
    parentIdByCompetitionId.set(record.competition_id, record.parent_id ?? null);
  }

  const competitionIdsWithResults = new Set<string>();

  for (const directCompetitionId of directCompetitionIdsWithResults) {
    let currentCompetitionId: string | null = directCompetitionId;
    const visitedCompetitionIds = new Set<string>();

    while (currentCompetitionId && !visitedCompetitionIds.has(currentCompetitionId)) {
      visitedCompetitionIds.add(currentCompetitionId);
      competitionIdsWithResults.add(currentCompetitionId);
      currentCompetitionId = parentIdByCompetitionId.get(currentCompetitionId) ?? null;
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
      .select("competition_id, player_id, order_number")
      .order("competition_id", { ascending: true })
      .order("player_id", { ascending: true })
      .order("order_number", { ascending: true })
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
  const seasonPointsByCompetitionId = new Map<string, number>();

  for (const row of rows) {
    const competitionId = row.competition_id?.trim();
    if (!competitionId) {
      continue;
    }

    const seasonPoints = Number(row.season_points);
    if (!Number.isFinite(seasonPoints)) {
      continue;
    }

    seasonPointsByCompetitionId.set(
      competitionId,
      (seasonPointsByCompetitionId.get(competitionId) ?? 0) + seasonPoints,
    );
  }

  return seasonPointsByCompetitionId;
}

function isMissingSeasonStandingsTableError(error: SupabaseQueryError | null): boolean {
  return error?.code === "42P01" && error.message.includes("season_standings");
}

async function listSeasonPointsByCompetition(
  competitionIds: readonly string[],
): Promise<Map<string, number>> {
  if (competitionIds.length === 0) {
    return new Map();
  }

  const supabase = createApiSupabaseAdminClient();
  const { data, error } = await supabase
    .schema(APP_PUBLIC_SCHEMA)
    .from("season_standings")
    .select("competition_id, season_points")
    .in("competition_id", [...competitionIds]);

  if (error) {
    if (isMissingSeasonStandingsTableError(error)) {
      return new Map();
    }

    throw new Error(`Failed to load season points for competitions list: ${error.message}`);
  }

  return aggregateSeasonStandingsByCompetition(
    (data ?? []) as SeasonStandingCompetitionRow[],
  );
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

      if (isMissingCategoryIdColumnError(error)) {
        const legacyResponse = await supabase
          .schema(APP_PUBLIC_SCHEMA)
          .from("competitions")
          .select(COMPETITIONS_SELECT_COLUMNS_LEGACY)
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

function isMissingCategoryIdColumnError(error: SupabaseQueryError | null): boolean {
  return error?.code === "42703" && error.message.includes("category_id");
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
  const [records, directCompetitionIdsWithResults] = await Promise.all([
    adapter.listCompetitions(),
    listCompetitionIdsWithResults(),
  ]);
  const competitionIdsWithResults = resolveCompetitionIdsWithResultsIncludingDescendants(
    records,
    directCompetitionIdsWithResults,
  );
  const seasonPointsByCompetitionId = await listSeasonPointsByCompetition(
    records.map((record) => record.competition_id),
  );

  return records.map((record) =>
    toCompetition({
      ...record,
      has_results: competitionIdsWithResults.has(record.competition_id),
      season_points: seasonPointsByCompetitionId.get(record.competition_id) ?? null,
    }),
  );
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
  const [record, competitionIdsWithResults, seasonPointsByCompetitionId] = await Promise.all([
    adapter.updateCompetitionCategory(payload),
    listCompetitionIdsWithResults(),
    listSeasonPointsByCompetition([payload.competitionId]),
  ]);

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
      handler: async ({ res }) => {
        const competitions =
          await (dependencies.listCompetitions ?? listCompetitionsFromRuntime)();

        sendSuccess(res, competitions, {
          count: competitions.length,
        });
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
