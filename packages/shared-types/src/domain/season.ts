export interface Season {
  seasonCode: string;
  name: string;
  dateFrom: string;
  dateTo: string;
  bestLeaguesCount: number;
  bestTournamentsCount: number;
  minPlayers: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface SeasonDbRecord {
  season_code: string;
  name: string;
  date_from: string;
  date_to: string;
  best_leagues_count: number;
  best_tournaments_count: number;
  min_players: number;
  created_at?: string;
  updated_at?: string;
}

export interface CreateSeasonRequest {
  seasonCode: string;
  name: string;
  dateFrom: string;
  dateTo: string;
  bestLeaguesCount: number;
  bestTournamentsCount: number;
  minPlayers: number;
}

export interface UpdateSeasonRequest {
  seasonCode: string;
  name: string;
  dateFrom: string;
  dateTo: string;
  bestLeaguesCount: number;
  bestTournamentsCount: number;
  minPlayers: number;
}

export interface DeleteSeasonRequest {
  seasonCode: string;
}

export function toSeasonDbRecord(season: Season): SeasonDbRecord {
  return {
    season_code: season.seasonCode,
    name: season.name,
    date_from: season.dateFrom,
    date_to: season.dateTo,
    best_leagues_count: season.bestLeaguesCount,
    best_tournaments_count: season.bestTournamentsCount,
    min_players: season.minPlayers,
    created_at: season.createdAt,
    updated_at: season.updatedAt,
  };
}
