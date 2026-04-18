export interface CompetitionHierarchyNode {
  competitionId: string;
  parentId?: string | null;
  recordType: string | null;
}

export interface CompetitionIdentity {
  competitionId: string;
  isScoringCompetition: boolean;
  ownerCompetitionId: string;
  resultSourceCompetitionIds: string[];
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

  // Preserve detail/list consistency for single-child wrappers such as
  // record_type=5 tour shells that wrap one event which then owns the rounds.
  if (directChildren.length === 1) {
    const [onlyChild] = directChildren;
    if (onlyChild) {
      return resolveCompetitionResultSourceIds(onlyChild, childrenByParentId);
    }
  }

  return [competition.competitionId];
}

export function resolveCompetitionIdentity<T extends CompetitionHierarchyNode>(
  competition: T,
  competitionsById: ReadonlyMap<string, T>,
  childrenByParentId: ReadonlyMap<string, readonly T[]>,
): CompetitionIdentity {
  return {
    competitionId: competition.competitionId,
    isScoringCompetition: isCompetitionScoringUnitCandidate(competition),
    ownerCompetitionId: resolveSeasonPointsCompetitionOwnerIdWithHierarchy(
      competition.competitionId,
      competitionsById,
      childrenByParentId,
    ),
    resultSourceCompetitionIds: resolveCompetitionResultSourceIds(
      competition,
      childrenByParentId,
    ),
  };
}

export function resolveCompetitionIdentityById<T extends CompetitionHierarchyNode>(
  competitionId: string,
  competitionsById: ReadonlyMap<string, T>,
  childrenByParentId: ReadonlyMap<string, readonly T[]>,
): CompetitionIdentity {
  const competition = competitionsById.get(competitionId);
  if (!competition) {
    return {
      competitionId,
      isScoringCompetition: true,
      ownerCompetitionId: competitionId,
      resultSourceCompetitionIds: [competitionId],
    };
  }

  return resolveCompetitionIdentity(competition, competitionsById, childrenByParentId);
}

function hasDirectRoundChildren<T extends CompetitionHierarchyNode>(
  competitionId: string,
  childrenByParentId: ReadonlyMap<string, readonly T[]>,
): boolean {
  return (childrenByParentId.get(competitionId) ?? []).some((child) => child.recordType === "1");
}

function resolveDirectPoolChildrenWithRounds<T extends CompetitionHierarchyNode>(
  competitionId: string,
  childrenByParentId: ReadonlyMap<string, readonly T[]>,
): T[] {
  return (childrenByParentId.get(competitionId) ?? []).filter(
    (child) =>
      child.recordType === "3" &&
      hasDirectRoundChildren(child.competitionId, childrenByParentId),
  );
}

function resolveSeasonPointsCompetitionOwnerIdWithHierarchy<T extends CompetitionHierarchyNode>(
  competitionId: string,
  competitionsById: ReadonlyMap<string, T>,
  childrenByParentId: ReadonlyMap<string, readonly T[]>,
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
    const normalizedParentId = normalizeParentId(competition.parentId);

    if (isCompetitionListVisibleRecordType(competition.recordType)) {
      if (competition.recordType === "4") {
        const poolChildrenWithRounds = resolveDirectPoolChildrenWithRounds(
          competition.competitionId,
          childrenByParentId,
        );
        if (poolChildrenWithRounds.length > 1 && competition.competitionId !== competitionId) {
          currentCompetitionId = normalizedParentId;
          continue;
        }
      }

      return competition.competitionId;
    }

    if (isStandaloneRoundCompetition(competition)) {
      return competition.competitionId;
    }

    if (competition.recordType === "3" && hasDirectRoundChildren(competition.competitionId, childrenByParentId)) {
      const parentCompetition = normalizedParentId
        ? competitionsById.get(normalizedParentId) ?? null
        : null;
      if (parentCompetition?.recordType === "4") {
        const siblingPoolsWithRounds = resolveDirectPoolChildrenWithRounds(
          parentCompetition.competitionId,
          childrenByParentId,
        );
        if (siblingPoolsWithRounds.length === 1) {
          return parentCompetition.competitionId;
        }
      }

      return competition.competitionId;
    }

    currentCompetitionId = normalizedParentId;
  }

  return lastKnownCompetitionId;
}

export function resolveSeasonPointsCompetitionOwnerId<T extends CompetitionHierarchyNode>(
  competitionId: string,
  competitionsById: ReadonlyMap<string, T>,
): string {
  return resolveSeasonPointsCompetitionOwnerIdWithHierarchy(
    competitionId,
    competitionsById,
    new Map<string, readonly T[]>(),
  );
}
