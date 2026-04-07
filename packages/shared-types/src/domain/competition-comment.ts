export const COMPETITION_COMMENT_MAX_LENGTH = 2000;

export type CompetitionCommentReasonCode =
  | "results_fetch_failed"
  | "results_save_failed"
  | "manual_category_update_failed"
  | "automated_category_resolution_failed"
  | "season_points_missing_coefficient"
  | "season_points_insufficient_players"
  | "season_points_missing_matrix"
  | "season_points_existing_rows_skipped";

const COMPETITION_COMMENT_MESSAGES: Record<CompetitionCommentReasonCode, string> = {
  results_fetch_failed: "Не удалось получить результаты соревнования.",
  results_save_failed: "Не удалось сохранить результаты соревнования.",
  manual_category_update_failed: "Не удалось сохранить категорию соревнования.",
  automated_category_resolution_failed:
    "Не удалось определить категорию для начисления очков сезона.",
  season_points_missing_coefficient:
    "Не удалось начислить очки сезона: не найден коэффициент категории.",
  season_points_insufficient_players:
    "Не удалось начислить очки сезона: недостаточно участников.",
  season_points_missing_matrix:
    "Не удалось начислить очки сезона: не найдена строка в таблице очков.",
  season_points_existing_rows_skipped:
    "Не удалось начислить очки сезона: записи уже существуют.",
};

export const COMPETITION_COMMENT_PRIORITY: readonly CompetitionCommentReasonCode[] = [
  "results_fetch_failed",
  "results_save_failed",
  "manual_category_update_failed",
  "automated_category_resolution_failed",
  "season_points_missing_coefficient",
  "season_points_insufficient_players",
  "season_points_missing_matrix",
  "season_points_existing_rows_skipped",
];

export function normalizeCompetitionComment(
  value: string | null | undefined,
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();
  if (normalizedValue.length === 0) {
    return null;
  }

  return normalizedValue.slice(0, COMPETITION_COMMENT_MAX_LENGTH);
}

export function resolveCompetitionCommentMessage(
  reason: CompetitionCommentReasonCode,
): string {
  return COMPETITION_COMMENT_MESSAGES[reason];
}

export function resolveCompetitionCommentReasonCode(
  comment: string | null | undefined,
): CompetitionCommentReasonCode | null {
  const normalizedComment = normalizeCompetitionComment(comment);
  if (!normalizedComment) {
    return null;
  }

  for (const [reason, message] of Object.entries(COMPETITION_COMMENT_MESSAGES) as Array<
    [CompetitionCommentReasonCode, string]
  >) {
    if (message === normalizedComment) {
      return reason;
    }
  }

  return null;
}

export function buildCompetitionComment(
  reason: CompetitionCommentReasonCode,
): string {
  return resolveCompetitionCommentMessage(reason);
}

export function clearCompetitionCommentIfMatches(
  comment: string | null | undefined,
  reasons: readonly CompetitionCommentReasonCode[],
): string | null {
  const normalizedComment = normalizeCompetitionComment(comment);
  const currentReason = resolveCompetitionCommentReasonCode(normalizedComment);

  if (currentReason && reasons.includes(currentReason)) {
    return null;
  }

  return normalizedComment;
}

export function shouldOverwriteCompetitionComment(
  currentComment: string | null | undefined,
  candidateReason: CompetitionCommentReasonCode,
): boolean {
  const normalizedCurrentComment = normalizeCompetitionComment(currentComment);
  if (!normalizedCurrentComment) {
    return true;
  }

  const currentReason = resolveCompetitionCommentReasonCode(normalizedCurrentComment);
  if (!currentReason) {
    return false;
  }

  const currentPriority = COMPETITION_COMMENT_PRIORITY.indexOf(currentReason);
  const candidatePriority = COMPETITION_COMMENT_PRIORITY.indexOf(candidateReason);

  return candidatePriority !== -1 && currentPriority !== -1 && candidatePriority < currentPriority;
}

export function reconcileCompetitionComment(
  currentComment: string | null | undefined,
  candidateReason: CompetitionCommentReasonCode | null,
  options: {
    clearManagedReasons?: readonly CompetitionCommentReasonCode[];
  } = {},
): string | null {
  const normalizedCurrentComment = normalizeCompetitionComment(currentComment);
  const currentReason = resolveCompetitionCommentReasonCode(normalizedCurrentComment);

  if (!candidateReason) {
    if (
      currentReason &&
      (options.clearManagedReasons ?? []).includes(currentReason)
    ) {
      return null;
    }

    return normalizedCurrentComment;
  }

  const candidateComment = resolveCompetitionCommentMessage(candidateReason);

  if (!normalizedCurrentComment) {
    return candidateComment;
  }

  if (!currentReason) {
    return normalizedCurrentComment;
  }

  const currentPriority = COMPETITION_COMMENT_PRIORITY.indexOf(currentReason);
  const candidatePriority = COMPETITION_COMMENT_PRIORITY.indexOf(candidateReason);

  if (candidatePriority !== -1 && currentPriority !== -1 && candidatePriority < currentPriority) {
    return candidateComment;
  }

  return normalizedCurrentComment;
}
