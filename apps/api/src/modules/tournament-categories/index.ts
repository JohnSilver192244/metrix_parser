import { randomUUID } from "node:crypto";

import type {
  CreateTournamentCategoryRequest,
  DeleteTournamentCategoryRequest,
  TournamentCategory,
  TournamentCategoryDbRecord,
  UpdateTournamentCategoryRequest,
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
const TOURNAMENT_CATEGORIES_SELECT_COLUMNS = [
  "category_id",
  "name",
  "description",
  "segments_count",
  "rating_gte",
  "rating_lt",
  "coefficient",
  "created_at",
  "updated_at",
].join(", ");

interface TournamentCategoryReadAdapter {
  listTournamentCategories(): Promise<TournamentCategoryDbRecord[]>;
}

interface TournamentCategoryWriteAdapter {
  createTournamentCategory(
    payload: CreateTournamentCategoryRequest,
  ): Promise<TournamentCategoryDbRecord>;
  updateTournamentCategory(
    payload: UpdateTournamentCategoryRequest,
  ): Promise<TournamentCategoryDbRecord>;
  deleteTournamentCategory(categoryId: string): Promise<void>;
}

export interface TournamentCategoriesRouteDependencies {
  listTournamentCategories?: () => Promise<TournamentCategory[]>;
  createTournamentCategory?: (
    payload: CreateTournamentCategoryRequest,
  ) => Promise<TournamentCategory>;
  updateTournamentCategory?: (
    payload: UpdateTournamentCategoryRequest,
  ) => Promise<TournamentCategory>;
  deleteTournamentCategory?: (
    payload: DeleteTournamentCategoryRequest,
  ) => Promise<void>;
}

function toTournamentCategory(
  record: TournamentCategoryDbRecord,
): TournamentCategory {
  return {
    categoryId: record.category_id,
    name: record.name,
    description: record.description,
    segmentsCount: record.segments_count,
    ratingGte: record.rating_gte,
    ratingLt: record.rating_lt,
    coefficient: record.coefficient,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

function createSupabaseTournamentCategoryReadAdapter(): TournamentCategoryReadAdapter {
  const supabase = createApiSupabaseAdminClient();

  return {
    async listTournamentCategories() {
      const { data, error } = await supabase
        .schema(APP_PUBLIC_SCHEMA)
        .from("tournament_categories")
        .select(TOURNAMENT_CATEGORIES_SELECT_COLUMNS)
        .order("name", { ascending: true });

      if (error) {
        throw new Error(`Failed to load tournament categories: ${error.message}`);
      }

      return (data ?? []) as unknown as TournamentCategoryDbRecord[];
    },
  };
}

function createSupabaseTournamentCategoryWriteAdapter(): TournamentCategoryWriteAdapter {
  const supabase = createApiSupabaseAdminClient();

  return {
    async createTournamentCategory(payload) {
      const { data, error } = await supabase
        .schema(APP_PUBLIC_SCHEMA)
        .from("tournament_categories")
        .insert({
          category_id: randomUUID(),
          name: payload.name,
          description: payload.description,
          segments_count: payload.segmentsCount,
          rating_gte: payload.ratingGte,
          rating_lt: payload.ratingLt,
          coefficient: payload.coefficient,
        })
        .select(TOURNAMENT_CATEGORIES_SELECT_COLUMNS)
        .single();

      if (error) {
        throw new Error(`Failed to create tournament category: ${error.message}`);
      }

      return data as unknown as TournamentCategoryDbRecord;
    },
    async updateTournamentCategory(payload) {
      const { data, error } = await supabase
        .schema(APP_PUBLIC_SCHEMA)
        .from("tournament_categories")
        .update({
          name: payload.name,
          description: payload.description,
          segments_count: payload.segmentsCount,
          rating_gte: payload.ratingGte,
          rating_lt: payload.ratingLt,
          coefficient: payload.coefficient,
          updated_at: new Date().toISOString(),
        })
        .eq("category_id", payload.categoryId)
        .select(TOURNAMENT_CATEGORIES_SELECT_COLUMNS)
        .single();

      if (error) {
        throw new Error(`Failed to update tournament category: ${error.message}`);
      }

      return data as unknown as TournamentCategoryDbRecord;
    },
    async deleteTournamentCategory(categoryId) {
      const { error } = await supabase
        .schema(APP_PUBLIC_SCHEMA)
        .from("tournament_categories")
        .delete()
        .eq("category_id", categoryId);

      if (error) {
        throw new Error(`Failed to delete tournament category: ${error.message}`);
      }
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

function normalizeNonNegativeNumber(value: unknown, fieldName: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new HttpError(
      400,
      `invalid_${fieldName}`,
      `${fieldName} must be a non-negative number`,
    );
  }

  return value;
}

function normalizeTwoDecimalNumber(value: unknown, fieldName: string): number {
  const normalizedValue = normalizeNonNegativeNumber(value, fieldName);
  const scaledValue = normalizedValue * 100;

  if (Math.abs(Math.round(scaledValue) - scaledValue) > Number.EPSILON * 100) {
    throw new HttpError(
      400,
      `invalid_${fieldName}`,
      `${fieldName} must have at most two decimal places`,
    );
  }

  return normalizedValue;
}

function parseCreateTournamentCategoryRequestBody(
  body: unknown,
): CreateTournamentCategoryRequest {
  if (!body || typeof body !== "object") {
    throw new HttpError(400, "invalid_payload", "Request body must be a JSON object");
  }

  const ratingGte = normalizeNonNegativeNumber(
    "ratingGte" in body ? body.ratingGte : undefined,
    "ratingGte",
  );
  const ratingLt = normalizeNonNegativeNumber(
    "ratingLt" in body ? body.ratingLt : undefined,
    "ratingLt",
  );

  if (ratingLt <= ratingGte) {
    throw new HttpError(
      400,
      "invalid_rating_range",
      "ratingLt must be greater than ratingGte",
    );
  }

  return {
    name: normalizeRequiredString("name" in body ? body.name : undefined, "name"),
    description: normalizeRequiredString(
      "description" in body ? body.description : undefined,
      "description",
    ),
    segmentsCount: normalizePositiveInteger(
      "segmentsCount" in body ? body.segmentsCount : undefined,
      "segmentsCount",
    ),
    ratingGte,
    ratingLt,
    coefficient: normalizeTwoDecimalNumber(
      "coefficient" in body ? body.coefficient : undefined,
      "coefficient",
    ),
  };
}

function parseUpdateTournamentCategoryRequestBody(
  body: unknown,
): UpdateTournamentCategoryRequest {
  if (!body || typeof body !== "object") {
    throw new HttpError(400, "invalid_payload", "Request body must be a JSON object");
  }

  return {
    categoryId: normalizeRequiredString(
      "categoryId" in body ? body.categoryId : undefined,
      "categoryId",
    ),
    ...parseCreateTournamentCategoryRequestBody(body),
  };
}

function parseDeleteTournamentCategoryRequestBody(
  body: unknown,
): DeleteTournamentCategoryRequest {
  if (!body || typeof body !== "object") {
    throw new HttpError(400, "invalid_payload", "Request body must be a JSON object");
  }

  return {
    categoryId: normalizeRequiredString(
      "categoryId" in body ? body.categoryId : undefined,
      "categoryId",
    ),
  };
}

async function listTournamentCategoriesFromRuntime(): Promise<TournamentCategory[]> {
  const adapter = createSupabaseTournamentCategoryReadAdapter();
  const records = await adapter.listTournamentCategories();

  return records.map(toTournamentCategory);
}

async function createTournamentCategoryFromRuntime(
  payload: CreateTournamentCategoryRequest,
): Promise<TournamentCategory> {
  const adapter = createSupabaseTournamentCategoryWriteAdapter();
  const record = await adapter.createTournamentCategory(payload);

  return toTournamentCategory(record);
}

async function updateTournamentCategoryFromRuntime(
  payload: UpdateTournamentCategoryRequest,
): Promise<TournamentCategory> {
  const adapter = createSupabaseTournamentCategoryWriteAdapter();
  const record = await adapter.updateTournamentCategory(payload);

  return toTournamentCategory(record);
}

async function deleteTournamentCategoryFromRuntime(
  payload: DeleteTournamentCategoryRequest,
): Promise<void> {
  const adapter = createSupabaseTournamentCategoryWriteAdapter();
  await adapter.deleteTournamentCategory(payload.categoryId);
}

export function getTournamentCategoriesRoutes(
  dependencies: TournamentCategoriesRouteDependencies = {},
  authDependencies: AuthGuardDependencies = {},
): RouteDefinition[] {
  return [
    {
      method: "GET",
      path: "/tournament-categories",
      handler: async ({ res }) => {
        const categories = await (
          dependencies.listTournamentCategories ?? listTournamentCategoriesFromRuntime
        )();

        sendSuccess(res, categories, {
          count: categories.length,
        });
      },
    },
    {
      method: "POST",
      path: "/tournament-categories",
      handler: async ({ req, res }) => {
        await requireAuthenticatedUser(readSessionToken(req), authDependencies);

        const body = await readJsonBody<CreateTournamentCategoryRequest>(req);
        const payload = parseCreateTournamentCategoryRequestBody(body);
        const category = await (
          dependencies.createTournamentCategory ?? createTournamentCategoryFromRuntime
        )(payload);

        sendSuccess(res, category, undefined, 201);
      },
    },
    {
      method: "PUT",
      path: "/tournament-categories",
      handler: async ({ req, res }) => {
        await requireAuthenticatedUser(readSessionToken(req), authDependencies);

        const body = await readJsonBody<UpdateTournamentCategoryRequest>(req);
        const payload = parseUpdateTournamentCategoryRequestBody(body);
        const category = await (
          dependencies.updateTournamentCategory ?? updateTournamentCategoryFromRuntime
        )(payload);

        sendSuccess(res, category);
      },
    },
    {
      method: "DELETE",
      path: "/tournament-categories",
      handler: async ({ req, res }) => {
        await requireAuthenticatedUser(readSessionToken(req), authDependencies);

        const body = await readJsonBody<DeleteTournamentCategoryRequest>(req);
        const payload = parseDeleteTournamentCategoryRequestBody(body);
        await (
          dependencies.deleteTournamentCategory ?? deleteTournamentCategoryFromRuntime
        )(payload);

        sendSuccess(res, null);
      },
    },
  ];
}
