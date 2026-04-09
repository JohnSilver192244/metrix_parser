import type {
  CreateDivisionRequest,
  DeleteDivisionRequest,
  Division,
  DivisionDbRecord,
  UpdateDivisionRequest,
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
const DIVISIONS_SELECT_COLUMNS = ["code"].join(", ");

interface DivisionReadAdapter {
  listDivisions(): Promise<DivisionDbRecord[]>;
}

interface DivisionWriteAdapter {
  createDivision(payload: CreateDivisionRequest): Promise<DivisionDbRecord>;
  updateDivision(payload: UpdateDivisionRequest): Promise<DivisionDbRecord>;
  deleteDivision(code: string): Promise<void>;
}

export interface DivisionsRouteDependencies {
  listDivisions?: () => Promise<Division[]>;
  createDivision?: (payload: CreateDivisionRequest) => Promise<Division>;
  updateDivision?: (payload: UpdateDivisionRequest) => Promise<Division>;
  deleteDivision?: (payload: DeleteDivisionRequest) => Promise<void>;
}

function toDivision(record: DivisionDbRecord): Division {
  return {
    code: record.code,
  };
}

function createSupabaseDivisionReadAdapter(): DivisionReadAdapter {
  const supabase = createApiSupabaseAdminClient();

  return {
    async listDivisions() {
      const { data, error } = await supabase
        .schema(APP_PUBLIC_SCHEMA)
        .from("divisions")
        .select(DIVISIONS_SELECT_COLUMNS)
        .order("code", { ascending: true });

      if (error) {
        throw new Error(`Failed to load divisions list: ${error.message}`);
      }

      return (data ?? []) as unknown as DivisionDbRecord[];
    },
  };
}

function createSupabaseDivisionWriteAdapter(): DivisionWriteAdapter {
  const supabase = createApiSupabaseAdminClient();

  return {
    async createDivision(payload) {
      const { data, error } = await supabase
        .schema(APP_PUBLIC_SCHEMA)
        .from("divisions")
        .insert({
          code: payload.code,
        })
        .select(DIVISIONS_SELECT_COLUMNS)
        .single();

      if (error) {
        throw new Error(`Failed to create division: ${error.message}`);
      }

      return data as unknown as DivisionDbRecord;
    },
    async updateDivision(payload) {
      const { data, error } = await supabase
        .schema(APP_PUBLIC_SCHEMA)
        .from("divisions")
        .update({
          code: payload.nextCode,
        })
        .eq("code", payload.code)
        .select(DIVISIONS_SELECT_COLUMNS)
        .single();

      if (error) {
        throw new Error(`Failed to update division: ${error.message}`);
      }

      return data as unknown as DivisionDbRecord;
    },
    async deleteDivision(code) {
      const { error } = await supabase
        .schema(APP_PUBLIC_SCHEMA)
        .from("divisions")
        .delete()
        .eq("code", code);

      if (error) {
        throw new Error(`Failed to delete division: ${error.message}`);
      }
    },
  };
}

function normalizeRequiredCode(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new HttpError(400, `invalid_${fieldName}`, `${fieldName} must be a string`);
  }

  const normalizedValue = value.trim();
  if (normalizedValue.length === 0) {
    throw new HttpError(400, `invalid_${fieldName}`, `${fieldName} is required`);
  }

  return normalizedValue;
}

function parseCreateDivisionRequestBody(body: unknown): CreateDivisionRequest {
  if (!body || typeof body !== "object") {
    throw new HttpError(400, "invalid_payload", "Request body must be a JSON object");
  }

  return {
    code: normalizeRequiredCode("code" in body ? body.code : undefined, "code"),
  };
}

function parseUpdateDivisionRequestBody(body: unknown): UpdateDivisionRequest {
  if (!body || typeof body !== "object") {
    throw new HttpError(400, "invalid_payload", "Request body must be a JSON object");
  }

  const code = normalizeRequiredCode("code" in body ? body.code : undefined, "code");
  const nextCode = normalizeRequiredCode(
    "nextCode" in body ? body.nextCode : undefined,
    "nextCode",
  );
  if (code === nextCode) {
    throw new HttpError(
      400,
      "invalid_nextCode",
      "nextCode must differ from the current code",
    );
  }

  return {
    code,
    nextCode,
  };
}

function parseDeleteDivisionRequestBody(body: unknown): DeleteDivisionRequest {
  if (!body || typeof body !== "object") {
    throw new HttpError(400, "invalid_payload", "Request body must be a JSON object");
  }

  return {
    code: normalizeRequiredCode("code" in body ? body.code : undefined, "code"),
  };
}

async function listDivisionsFromRuntime(): Promise<Division[]> {
  const adapter = createSupabaseDivisionReadAdapter();
  const records = await adapter.listDivisions();

  return records.map(toDivision);
}

async function createDivisionFromRuntime(
  payload: CreateDivisionRequest,
): Promise<Division> {
  const adapter = createSupabaseDivisionWriteAdapter();
  const record = await adapter.createDivision(payload);

  return toDivision(record);
}

async function updateDivisionFromRuntime(
  payload: UpdateDivisionRequest,
): Promise<Division> {
  const adapter = createSupabaseDivisionWriteAdapter();
  const record = await adapter.updateDivision(payload);

  return toDivision(record);
}

async function deleteDivisionFromRuntime(
  payload: DeleteDivisionRequest,
): Promise<void> {
  const adapter = createSupabaseDivisionWriteAdapter();
  await adapter.deleteDivision(payload.code);
}

export function getDivisionsRoutes(
  dependencies: DivisionsRouteDependencies = {},
  authDependencies: AuthGuardDependencies = {},
): RouteDefinition[] {
  return [
    {
      method: "GET",
      path: "/divisions",
      handler: async ({ res }) => {
        const divisions = await (dependencies.listDivisions ?? listDivisionsFromRuntime)();

        sendSuccess(res, divisions, {
          count: divisions.length,
        });
      },
    },
    {
      method: "POST",
      path: "/divisions",
      handler: async ({ req, res }) => {
        await requireAuthenticatedUser(readSessionToken(req), authDependencies);

        const body = await readJsonBody<CreateDivisionRequest>(req);
        const payload = parseCreateDivisionRequestBody(body);
        const division = await (
          dependencies.createDivision ?? createDivisionFromRuntime
        )(payload);

        sendSuccess(res, division, undefined, 201);
      },
    },
    {
      method: "PUT",
      path: "/divisions",
      handler: async ({ req, res }) => {
        await requireAuthenticatedUser(readSessionToken(req), authDependencies);

        const body = await readJsonBody<UpdateDivisionRequest>(req);
        const payload = parseUpdateDivisionRequestBody(body);
        const division = await (
          dependencies.updateDivision ?? updateDivisionFromRuntime
        )(payload);

        sendSuccess(res, division);
      },
    },
    {
      method: "DELETE",
      path: "/divisions",
      handler: async ({ req, res }) => {
        await requireAuthenticatedUser(readSessionToken(req), authDependencies);

        const body = await readJsonBody<DeleteDivisionRequest>(req);
        const payload = parseDeleteDivisionRequestBody(body);
        await (dependencies.deleteDivision ?? deleteDivisionFromRuntime)(payload);

        sendSuccess(res, null);
      },
    },
  ];
}
