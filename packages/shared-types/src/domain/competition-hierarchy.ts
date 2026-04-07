export interface CompetitionHierarchyNode {
  competitionId: string;
  parentId?: string | null;
  recordType: string | null;
}

const LIST_VISIBLE_COMPETITION_RECORD_TYPES = new Set(["2", "4"]);

function normalizeParentId(parentId: string | null | undefined): string | null {
  const normalized = parentId?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
}

export function buildCompetitionChildrenByParentId<T extends CompetitionHierarchyNode>(
  competitions: readonly T[],
): Map<string, T[]> {
  const childrenByParentId = new Map<string, T[]>();

  for (const competition of competitions) {
    const parentId = normalizeParentId(competition.parentId);
    if (!parentId) {
      continue;
    }

    const current = childrenByParentId.get(parentId) ?? [];
    current.push(competition);
    childrenByParentId.set(parentId, current);
  }

  return childrenByParentId;
}

export function isCompetitionListVisibleRecordType(value: string | null): boolean {
  return value !== null && LIST_VISIBLE_COMPETITION_RECORD_TYPES.has(value);
}

export function isStandaloneRoundCompetition<T extends CompetitionHierarchyNode>(
  competition: T,
): boolean {
  return competition.recordType === "1" && normalizeParentId(competition.parentId) === null;
}

export function isCompetitionScoringUnitCandidate<T extends CompetitionHierarchyNode>(
  competition: T,
): boolean {
  return (
    isCompetitionListVisibleRecordType(competition.recordType) ||
    isStandaloneRoundCompetition(competition)
  );
}

export function resolveCompetitionResultSourceIds<T extends CompetitionHierarchyNode>(
  competition: T,
  childrenByParentId: ReadonlyMap<string, readonly T[]>,
): string[] {
  const directChildren = childrenByParentId.get(competition.competitionId) ?? [];
  const directRoundChildren = directChildren.filter((child) => child.recordType === "1");

  if (directRoundChildren.length > 0) {
    return directRoundChildren.map((child) => child.competitionId);
  }

  if (competition.recordType === "4") {
    const directPoolChildren = directChildren.filter((child) => child.recordType === "3");

    if (directPoolChildren.length === 1) {
      const [poolCompetition] = directPoolChildren;
      if (poolCompetition) {
        const poolRoundChildren =
          (childrenByParentId.get(poolCompetition.competitionId) ?? [])
            .filter((child) => child.recordType === "1");

        if (poolRoundChildren.length > 0) {
          return poolRoundChildren.map((child) => child.competitionId);
        }
      }
    }
  }

  return [competition.competitionId];
}

export function resolveSeasonPointsCompetitionOwnerId<T extends CompetitionHierarchyNode>(
  competitionId: string,
  competitionsById: ReadonlyMap<string, T>,
): string {
  const visitedCompetitionIds = new Set<string>();
  let currentCompetitionId: string | null = competitionId;
  let lastKnownCompetitionId = competitionId;

  while (currentCompetitionId && !visitedCompetitionIds.has(currentCompetitionId)) {
    visitedCompetitionIds.add(currentCompetitionId);
    const competition = competitionsById.get(currentCompetitionId) ?? null;

    if (!competition) {
      return lastKnownCompetitionId;
    }

    lastKnownCompetitionId = competition.competitionId;

    if (isCompetitionScoringUnitCandidate(competition)) {
      return competition.competitionId;
    }

    currentCompetitionId = normalizeParentId(competition.parentId);
  }

  return lastKnownCompetitionId;
}
