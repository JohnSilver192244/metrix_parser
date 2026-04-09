import type { SupabaseClient } from "@supabase/supabase-js";

import { resolveSeasonPointsCompetitionOwnerId } from "@metrix-parser/shared-types";

const APP_PUBLIC_SCHEMA = "app_public";
const COMPETITIONS_SELECT_COLUMNS =
  "competition_id, parent_id, record_type, players_count, comment";
const MIN_POOL_PLAYERS = 8;

export const RESULTS_FETCH_BLOCKER_COMMENT = "Не удалось получить результаты.";
export const RESULTS_SAVE_BLOCKER_COMMENT = "Не удалось сохранить результаты.";
export const RESULTS_SAVE_INVALID_BLOCKER_COMMENT =
  "Нельзя сохранить результаты: в данных результатов не хватает обязательных полей.";
export const RESULTS_SAVE_SMALL_POOLS_BLOCKER_COMMENT =
  "Нельзя сохранить результаты: в пулах меньше 8 игроков.";

const WORKER_MANAGED_COMMENTS = new Set([
  RESULTS_FETCH_BLOCKER_COMMENT,
  RESULTS_SAVE_BLOCKER_COMMENT,
  RESULTS_SAVE_INVALID_BLOCKER_COMMENT,
  RESULTS_SAVE_SMALL_POOLS_BLOCKER_COMMENT,
]);

export interface CompetitionCommentRow {
  competition_id: string;
  parent_id?: string | null;
  record_type: string | null;
  players_count: number | null;
  comment?: string | null;
}

export interface CompetitionCommentsPersistenceAdapter {
  findByCompetitionId(competitionId: string): Promise<CompetitionCommentRow | null>;
  findByCompetitionIds(competitionIds: string[]): Promise<CompetitionCommentRow[]>;
  updateComment(competitionId: string, comment: string | null): Promise<void>;
}

export interface CompetitionCommentsRepository {
  loadCompetitionGraph(competitionIds: readonly string[]): Promise<Map<string, CompetitionCommentRow>>;
  reconcileResultsComments(input: ReconcileResultsCompetitionCommentsInput): Promise<void>;
}

export interface ReconcileResultsCompetitionCommentsInput {
  competitionIds: readonly string[];
  fetchFailureCompetitionIds?: readonly string[];
  saveFailureCommentsByCompetitionId?: ReadonlyMap<string, string>;
}

interface ReconcileCommentState {
  currentComment: string | null;
  nextComment: string | null;
}

function normalizeCompetitionId(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
}

function createCompetitionNode(row: CompetitionCommentRow) {
  return {
    competitionId: row.competition_id,
    parentId: row.parent_id ?? null,
    recordType: row.record_type,
  };
}

function isPoolCompetition(row: CompetitionCommentRow): boolean {
  return row.record_type === "3";
}

function isWorkerManagedComment(value: string | null | undefined): boolean {
  return value != null && WORKER_MANAGED_COMMENTS.has(value);
}

function resolveOwnerIds(
  rowsByCompetitionId: ReadonlyMap<string, CompetitionCommentRow>,
  competitionIds: readonly string[],
): Map<string, string> {
  const competitionNodesByCompetitionId = new Map(
    [...rowsByCompetitionId.entries()].map(([competitionId, row]) => [
      competitionId,
      createCompetitionNode(row),
    ]),
  );
  const ownerIds = new Map<string, string>();

  for (const competitionId of competitionIds) {
    const normalizedCompetitionId = normalizeCompetitionId(competitionId);
    if (!normalizedCompetitionId) {
      continue;
    }

    ownerIds.set(
      normalizedCompetitionId,
      resolveSeasonPointsCompetitionOwnerId(
        normalizedCompetitionId,
        competitionNodesByCompetitionId,
      ),
    );
  }

  return ownerIds;
}

function resolveSmallPoolOwnerIds(
  rowsByCompetitionId: ReadonlyMap<string, CompetitionCommentRow>,
): Set<string> {
  const childrenByParentId = new Map<string, CompetitionCommentRow[]>();

  for (const row of rowsByCompetitionId.values()) {
    const parentId = normalizeCompetitionId(row.parent_id);
    if (!parentId) {
      continue;
    }

    const current = childrenByParentId.get(parentId) ?? [];
    current.push(row);
    childrenByParentId.set(parentId, current);
  }

  const ownerIds = new Set<string>();

  for (const row of rowsByCompetitionId.values()) {
    const directChildren = childrenByParentId.get(row.competition_id) ?? [];
    const directPoolChildren = directChildren.filter(isPoolCompetition);

    if (
      directPoolChildren.length > 0 &&
      directPoolChildren.every((poolCompetition) => {
        return (
          typeof poolCompetition.players_count === "number" &&
          poolCompetition.players_count < MIN_POOL_PLAYERS
        );
      })
    ) {
      ownerIds.add(row.competition_id);
    }
  }

  return ownerIds;
}

async function loadCompetitionGraph(
  adapter: CompetitionCommentsPersistenceAdapter,
  competitionIds: readonly string[],
): Promise<Map<string, CompetitionCommentRow>> {
  const rowsByCompetitionId = new Map<string, CompetitionCommentRow>();
  const pendingCompetitionIds = new Set(
    competitionIds
      .map((competitionId) => normalizeCompetitionId(competitionId))
      .filter((competitionId): competitionId is string => competitionId !== null),
  );

  while (pendingCompetitionIds.size > 0) {
    const idsToLoad = [...pendingCompetitionIds];
    pendingCompetitionIds.clear();

    const loadedRows = await adapter.findByCompetitionIds(idsToLoad);
    for (const row of loadedRows) {
      rowsByCompetitionId.set(row.competition_id, row);
    }

    for (const competitionId of idsToLoad) {
      const loadedRow = rowsByCompetitionId.get(competitionId) ?? null;
      if (!loadedRow) {
        continue;
      }

      const parentId = normalizeCompetitionId(loadedRow.parent_id);
      if (parentId && !rowsByCompetitionId.has(parentId)) {
        pendingCompetitionIds.add(parentId);
      }
    }
  }

  return rowsByCompetitionId;
}

export function createCompetitionCommentsRepository(
  adapter: CompetitionCommentsPersistenceAdapter,
): CompetitionCommentsRepository {
  return {
    loadCompetitionGraph(competitionIds) {
      return loadCompetitionGraph(adapter, competitionIds);
    },
    async reconcileResultsComments(input) {
      const rowsByCompetitionId = await loadCompetitionGraph(adapter, input.competitionIds);
      if (rowsByCompetitionId.size === 0) {
        return;
      }

      const ownerIdsByCompetitionId = resolveOwnerIds(
        rowsByCompetitionId,
        input.competitionIds,
      );
      const statesByOwnerId = new Map<string, ReconcileCommentState>();

      for (const ownerId of new Set(ownerIdsByCompetitionId.values())) {
        const ownerRow = rowsByCompetitionId.get(ownerId) ?? null;
        statesByOwnerId.set(ownerId, {
          currentComment: ownerRow?.comment ?? null,
          nextComment: null,
        });
      }

      const assignComment = (ownerId: string, comment: string) => {
        const currentState = statesByOwnerId.get(ownerId);
        if (!currentState || currentState.nextComment !== null) {
          return;
        }

        currentState.nextComment = comment;
      };

      for (const competitionId of input.fetchFailureCompetitionIds ?? []) {
        const ownerId = ownerIdsByCompetitionId.get(competitionId) ?? null;
        if (!ownerId) {
          continue;
        }

        assignComment(ownerId, RESULTS_FETCH_BLOCKER_COMMENT);
      }

      const smallPoolOwnerIds = resolveSmallPoolOwnerIds(rowsByCompetitionId);
      for (const ownerId of smallPoolOwnerIds) {
        assignComment(ownerId, RESULTS_SAVE_SMALL_POOLS_BLOCKER_COMMENT);
      }

      for (const [competitionId, comment] of input.saveFailureCommentsByCompetitionId ?? []) {
        const ownerId = ownerIdsByCompetitionId.get(competitionId) ?? null;
        if (!ownerId) {
          continue;
        }

        assignComment(ownerId, comment);
      }

      for (const [ownerId, state] of statesByOwnerId) {
        const shouldClearComment =
          state.nextComment === null && isWorkerManagedComment(state.currentComment);
        const shouldUpdateComment =
          state.nextComment !== null && state.nextComment !== state.currentComment;

        if (shouldClearComment) {
          await adapter.updateComment(ownerId, null);
          continue;
        }

        if (shouldUpdateComment) {
          await adapter.updateComment(ownerId, state.nextComment);
        }
      }
    },
  };
}

export function createSupabaseCompetitionCommentsAdapter(
  supabase: SupabaseClient,
): CompetitionCommentsPersistenceAdapter {
  return {
    async findByCompetitionId(competitionId) {
      const { data, error } = await supabase
        .schema(APP_PUBLIC_SCHEMA)
        .from("competitions")
        .select(COMPETITIONS_SELECT_COLUMNS)
        .eq("competition_id", competitionId)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to load competition comment row: ${error.message}`);
      }

      return (data as CompetitionCommentRow | null) ?? null;
    },
    async findByCompetitionIds(competitionIds) {
      if (competitionIds.length === 0) {
        return [];
      }

      const { data, error } = await supabase
        .schema(APP_PUBLIC_SCHEMA)
        .from("competitions")
        .select(COMPETITIONS_SELECT_COLUMNS)
        .in("competition_id", competitionIds);

      if (error) {
        throw new Error(`Failed to load competition comment rows: ${error.message}`);
      }

      return (data ?? []) as CompetitionCommentRow[];
    },
    async updateComment(competitionId, comment) {
      const { error } = await supabase
        .schema(APP_PUBLIC_SCHEMA)
        .from("competitions")
        .update({
          comment,
          updated_at: new Date().toISOString(),
        })
        .eq("competition_id", competitionId);

      if (error) {
        throw new Error(`Failed to update competition comment: ${error.message}`);
      }
    },
  };
}

export function resolveResultsSaveFailureComment(
  issueCode: string | null | undefined,
): string {
  if (
    issueCode === "invalid_competition_result_record" ||
    issueCode === "competition_result_missing_identity" ||
    issueCode === "competition_result_missing_score"
  ) {
    return RESULTS_SAVE_INVALID_BLOCKER_COMMENT;
  }

  return RESULTS_SAVE_BLOCKER_COMMENT;
}
