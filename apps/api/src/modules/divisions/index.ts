import type {
  Division,
  DivisionDbRecord,
} from "@metrix-parser/shared-types";

import { sendSuccess } from "../../lib/http";
import type { RouteDefinition } from "../../lib/router";
import { createApiSupabaseAdminClient } from "../../lib/supabase-admin";

const APP_PUBLIC_SCHEMA = "app_public";
const DIVISIONS_SELECT_COLUMNS = ["code"].join(", ");

interface DivisionReadAdapter {
  listDivisions(): Promise<DivisionDbRecord[]>;
}

export interface DivisionsRouteDependencies {
  listDivisions?: () => Promise<Division[]>;
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

async function listDivisionsFromRuntime(): Promise<Division[]> {
  const adapter = createSupabaseDivisionReadAdapter();
  const records = await adapter.listDivisions();

  return records.map(toDivision);
}

export function getDivisionsRoutes(
  dependencies: DivisionsRouteDependencies = {},
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
  ];
}
