const COMPETITION_RESULTS_PATH_PREFIX = "/competitions/";
const PLAYER_PATH_PREFIX = "/players/";

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

export function buildPlayerPath(playerId: string): string {
  return `${PLAYER_PATH_PREFIX}${encodeURIComponent(playerId)}`;
}

export function resolvePlayerId(pathname: string): string | null {
  if (!pathname.startsWith(PLAYER_PATH_PREFIX)) {
    return null;
  }

  const encodedPlayerId = pathname.slice(PLAYER_PATH_PREFIX.length);
  if (!encodedPlayerId || encodedPlayerId.includes("/")) {
    return null;
  }

  try {
    return decodeURIComponent(encodedPlayerId);
  } catch {
    return null;
  }
}
