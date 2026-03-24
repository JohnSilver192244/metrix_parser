export interface Player {
  playerId: string;
  playerName: string;
  division?: string | null;
  rdga?: boolean | null;
  competitionsCount?: number;
}

export interface PlayerDbRecord {
  player_id: string;
  player_name: string;
  division?: string | null;
  rdga?: boolean | null;
  competitions_count?: number;
}

export interface UpdatePlayerRequest {
  playerId: string;
  division: string | null;
  rdga: boolean | null;
}

export function toPlayerDbRecord(player: Player): PlayerDbRecord {
  return {
    player_id: player.playerId,
    player_name: player.playerName,
    division: player.division,
    rdga: player.rdga,
    competitions_count: player.competitionsCount,
  };
}
