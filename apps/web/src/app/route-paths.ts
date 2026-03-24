const COMPETITION_RESULTS_PATH_PREFIX = "/competitions/";

export function buildCompetitionResultsPath(competitionId: string): string {
  return `${COMPETITION_RESULTS_PATH_PREFIX}${encodeURIComponent(competitionId)}`;
}

export function resolveCompetitionResultsCompetitionId(
  pathname: string,
): string | null {
  if (!pathname.startsWith(COMPETITION_RESULTS_PATH_PREFIX)) {
    return null;
  }

  const encodedCompetitionId = pathname.slice(COMPETITION_RESULTS_PATH_PREFIX.length);
  if (!encodedCompetitionId || encodedCompetitionId.includes("/")) {
    return null;
  }

  try {
    return decodeURIComponent(encodedCompetitionId);
  } catch {
    return null;
  }
}
