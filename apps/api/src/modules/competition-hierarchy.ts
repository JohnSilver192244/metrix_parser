export interface CompetitionHierarchyContextRow {
  competition_id: string;
  parent_id: string | null;
  record_type: string | null;
}

interface LoadCompetitionHierarchyContextOptions<
  TRow extends CompetitionHierarchyContextRow,
> {
  competitionIds: readonly string[];
  loadRowsByCompetitionIds: (competitionIds: readonly string[]) => Promise<readonly TRow[]>;
  loadRowsByParentIds: (parentIds: readonly string[]) => Promise<readonly TRow[]>;
}

function normalizeId(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function uniqueNormalizedIds(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))];
}

export async function loadCompetitionHierarchyContext<
  TRow extends CompetitionHierarchyContextRow,
>({
  competitionIds,
  loadRowsByCompetitionIds,
  loadRowsByParentIds,
}: LoadCompetitionHierarchyContextOptions<TRow>): Promise<Map<string, TRow>> {
  const competitionsById = new Map<string, TRow>();
  let pendingCompetitionIds = uniqueNormalizedIds(competitionIds);

  while (pendingCompetitionIds.length > 0) {
    const rows = await loadRowsByCompetitionIds(pendingCompetitionIds);
    const parentIdsToLoad = new Set<string>();

    for (const row of rows) {
      competitionsById.set(row.competition_id, row);

      const parentId = normalizeId(row.parent_id);
      if (parentId.length > 0 && !competitionsById.has(parentId)) {
        parentIdsToLoad.add(parentId);
      }
    }

    pendingCompetitionIds = [...parentIdsToLoad];
  }

  let pendingParentIds = [...competitionsById.keys()];
  const expandedParentIds = new Set<string>();

  while (pendingParentIds.length > 0) {
    const parentIdsToQuery = pendingParentIds.filter((parentId) => !expandedParentIds.has(parentId));
    if (parentIdsToQuery.length === 0) {
      break;
    }

    for (const parentId of parentIdsToQuery) {
      expandedParentIds.add(parentId);
    }

    const childRows = await loadRowsByParentIds(parentIdsToQuery);
    const nextParentIds = new Set<string>();

    for (const row of childRows) {
      if (!competitionsById.has(row.competition_id)) {
        nextParentIds.add(row.competition_id);
      }

      competitionsById.set(row.competition_id, row);
    }

    pendingParentIds = [...nextParentIds];
  }

  return competitionsById;
}
