import type { SupabaseClient } from "@supabase/supabase-js";

const APP_PUBLIC_SCHEMA = "app_public";

export interface CompetitionHierarchyRow {
  competition_id: string;
  parent_id: string | null;
  record_type: string | null;
}

interface CompetitionHierarchyLoaderAdapter {
  listByCompetitionIds(
    competitionIds: readonly string[],
  ): Promise<CompetitionHierarchyRow[]>;
  listByParentIds(parentIds: readonly string[]): Promise<CompetitionHierarchyRow[]>;
}

function dedupeNonEmptyIds(ids: readonly string[]): string[] {
  return [...new Set(
    ids
      .map((value) => value.trim())
      .filter((value) => value.length > 0),
  )];
}

export async function loadCompetitionHierarchyContext(
  competitionIds: readonly string[],
  adapter: CompetitionHierarchyLoaderAdapter,
): Promise<Map<string, CompetitionHierarchyRow>> {
  const competitionsById = new Map<string, CompetitionHierarchyRow>();

  let pendingCompetitionIds = dedupeNonEmptyIds(competitionIds);

  while (pendingCompetitionIds.length > 0) {
    const fetchedRows = await adapter.listByCompetitionIds(pendingCompetitionIds);

    for (const row of fetchedRows) {
      competitionsById.set(row.competition_id, row);
    }

    pendingCompetitionIds = dedupeNonEmptyIds(
      fetchedRows
        .map((row) => row.parent_id ?? "")
        .filter((parentId) => !competitionsById.has(parentId)),
    );
  }

  let pendingParentIds = [...competitionsById.keys()];

  while (pendingParentIds.length > 0) {
    const fetchedRows = await adapter.listByParentIds(pendingParentIds);
    const nextParentIds: string[] = [];

    for (const row of fetchedRows) {
      if (competitionsById.has(row.competition_id)) {
        continue;
      }

      competitionsById.set(row.competition_id, row);
      nextParentIds.push(row.competition_id);
    }

    pendingParentIds = dedupeNonEmptyIds(nextParentIds);
  }

  return competitionsById;
}

export function createSupabaseCompetitionHierarchyLoader(
  supabase: SupabaseClient,
  contextLabel: string,
): CompetitionHierarchyLoaderAdapter {
  return {
    async listByCompetitionIds(competitionIds) {
      if (competitionIds.length === 0) {
        return [];
      }

      const { data, error } = await supabase
        .schema(APP_PUBLIC_SCHEMA)
        .from("competitions")
        .select("competition_id, parent_id, record_type")
        .in("competition_id", competitionIds);

      if (error) {
        throw new Error(`Failed to load competition hierarchy for ${contextLabel}: ${error.message}`);
      }

      return (data ?? []) as CompetitionHierarchyRow[];
    },
    async listByParentIds(parentIds) {
      if (parentIds.length === 0) {
        return [];
      }

      const { data, error } = await supabase
        .schema(APP_PUBLIC_SCHEMA)
        .from("competitions")
        .select("competition_id, parent_id, record_type")
        .in("parent_id", parentIds);

      if (error) {
        throw new Error(`Failed to load competition hierarchy for ${contextLabel}: ${error.message}`);
      }

      return (data ?? []) as CompetitionHierarchyRow[];
    },
  };
}
