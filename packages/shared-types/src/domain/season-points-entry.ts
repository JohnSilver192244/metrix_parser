export interface SeasonPointsEntry {
  seasonCode: string;
  playersCount: number;
  placement: number;
  points: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface SeasonPointsEntryDbRecord {
  season_code: string;
  players_count: number;
  placement: number;
  points: number;
  created_at?: string;
  updated_at?: string;
}

export interface CreateSeasonPointsEntryRequest {
  seasonCode: string;
  playersCount: number;
  placement: number;
  points: number;
}

export interface UpdateSeasonPointsEntryRequest {
  seasonCode: string;
  playersCount: number;
  placement: number;
  points: number;
}

export interface DeleteSeasonPointsEntryRequest {
  seasonCode: string;
  playersCount: number;
  placement: number;
}

export function toSeasonPointsEntryDbRecord(
  entry: SeasonPointsEntry,
): SeasonPointsEntryDbRecord {
  return {
    season_code: entry.seasonCode,
    players_count: entry.playersCount,
    placement: entry.placement,
    points: entry.points,
    created_at: entry.createdAt,
    updated_at: entry.updatedAt,
  };
}
