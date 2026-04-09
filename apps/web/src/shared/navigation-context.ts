import {
  readSessionStorageValue,
  writeSessionStorageValue,
} from "./session-storage";

const COMPETITION_RESULTS_SOURCE_PLAYER_STORAGE_KEY =
  "competition-results:source-player";

interface CompetitionResultsSourcePlayerContext {
  competitionId: string;
  playerId: string;
  playerName: string;
}

export interface CompetitionResultsSourcePlayer {
  playerId: string;
  playerName: string;
}

export function setCompetitionResultsSourcePlayerContext(
  competitionId: string,
  player: CompetitionResultsSourcePlayer,
): void {
  const normalizedCompetitionId = competitionId.trim();
  const normalizedPlayerId = player.playerId.trim();
  const normalizedPlayerName = player.playerName.trim();

  if (
    normalizedCompetitionId.length === 0 ||
    normalizedPlayerId.length === 0 ||
    normalizedPlayerName.length === 0
  ) {
    return;
  }

  writeSessionStorageValue<CompetitionResultsSourcePlayerContext>(
    COMPETITION_RESULTS_SOURCE_PLAYER_STORAGE_KEY,
    {
      competitionId: normalizedCompetitionId,
      playerId: normalizedPlayerId,
      playerName: normalizedPlayerName,
    },
  );
}

export function clearCompetitionResultsSourcePlayerContext(): void {
  writeSessionStorageValue<null>(
    COMPETITION_RESULTS_SOURCE_PLAYER_STORAGE_KEY,
    null,
  );
}

export function consumeCompetitionResultsSourcePlayerContext(
  competitionId: string,
): CompetitionResultsSourcePlayer | null {
  const context = readSessionStorageValue<CompetitionResultsSourcePlayerContext | null>(
    COMPETITION_RESULTS_SOURCE_PLAYER_STORAGE_KEY,
    null,
  );

  clearCompetitionResultsSourcePlayerContext();

  if (!context) {
    return null;
  }

  if (context.competitionId !== competitionId) {
    return null;
  }

  const playerId = context.playerId?.trim() ?? "";
  const playerName = context.playerName?.trim() ?? "";

  if (playerId.length === 0 || playerName.length === 0) {
    return null;
  }

  return {
    playerId,
    playerName,
  };
}
