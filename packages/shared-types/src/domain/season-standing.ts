export interface SeasonStanding {
  seasonCode: string;
  competitionId: string;
  playerId: string;
  categoryId: string | null;
  placement: number;
  playersCount: number;
  rawPoints: number;
  coefficient: number;
  seasonPoints: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface SeasonStandingDbRecord {
  season_code: string;
  competition_id: string;
  player_id: string;
  category_id: string | null;
  placement: number;
  players_count: number;
  raw_points: number;
  coefficient: number;
  season_points: number;
  created_at?: string;
  updated_at?: string;
}

export interface RunSeasonPointsAccrualRequest {
  seasonCode: string;
  overwriteExisting?: boolean;
}

export interface RunSeasonPointsAccrualResult {
  seasonCode: string;
  overwriteExisting: boolean;
  competitionsInSeason: number;
  competitionsEligible: number;
  competitionsSkippedByExisting: number;
  competitionsWithPoints: number;
  rowsPrepared: number;
  rowsPersisted: number;
}
