export interface CompetitionResult {
  competitionId: string;
  playerId: string;
  competitionName?: string | null;
  playerName?: string | null;
  playerRdga?: boolean | null;
  className: string | null;
  sum: number | null;
  diff: number | null;
  dnf: boolean;
  seasonPoints?: number | null;
}

export interface CompetitionResultDbRecord {
  competition_id: string;
  player_id: string;
  competition_name?: string | null;
  player_name?: string | null;
  player_rdga?: boolean | null;
  class_name: string | null;
  sum: number | null;
  diff: number | null;
  dnf: boolean;
  season_points?: number | null;
}

export function toCompetitionResultDbRecord(
  result: CompetitionResult,
): CompetitionResultDbRecord {
  return {
    competition_id: result.competitionId,
    player_id: result.playerId,
    class_name: result.className,
    sum: result.sum,
    diff: result.diff,
    dnf: result.dnf,
    season_points: result.seasonPoints ?? null,
  };
}
