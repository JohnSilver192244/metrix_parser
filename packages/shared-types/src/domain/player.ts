export interface Player {
  playerId: string;
  playerName: string;
  division?: string | null;
  rdga?: boolean | null;
  rdgaSince?: string | null;
  seasonDivision?: string | null;
  seasonPoints?: number | null;
  seasonCreditPoints?: number | null;
  competitionsCount?: number;
}

export interface PlayerDbRecord {
  player_id: string;
  player_name: string;
  division?: string | null;
  rdga?: boolean | null;
  rdga_since?: string | null;
  rdgaSince?: string | null;
  season_division?: string | null;
  seasonDivision?: string | null;
  season_points?: number | null;
  season_credit_points?: number | null;
  competitions_count?: number;
}

export interface UpdatePlayerRequest {
  playerId: string;
  division: string | null;
  rdga: boolean | null;
  rdgaSince: string | null;
  seasonDivision: string | null;
}

export interface PlayerCompetitionResult {
  competitionId: string;
  competitionName: string;
  competitionDate: string;
  category: string | null;
  placement: number | null;
  sum: number | null;
  dnf: boolean;
  seasonPoints: number | null;
}

export function toPlayerDbRecord(player: Player): PlayerDbRecord {
  return {
    player_id: player.playerId,
    player_name: player.playerName,
    division: player.division,
    rdga: player.rdga,
    rdga_since: player.rdgaSince,
    season_division: player.seasonDivision,
    season_points: player.seasonPoints,
    season_credit_points: player.seasonCreditPoints,
    competitions_count: player.competitionsCount,
  };
}
