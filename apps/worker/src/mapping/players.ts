import {
  createUpdateIssue,
  type Player,
  type UpdateProcessingIssue,
} from "@metrix-parser/shared-types";

import type {
  DiscGolfMetrixResultsResponse,
  DiscGolfMetrixSourceRecord,
} from "../integration/discgolfmetrix";
import {
  parseResultPlayerFragment,
  readResultEntries,
} from "../parsing/result-player";

export interface ExtractedPlayerEntry {
  competitionId: string;
  metrixId: string | null;
  player: Player;
  sourceRecord: DiscGolfMetrixSourceRecord;
}

export interface PlayersFromResultsMappingResult {
  players: Player[];
  extractedPlayers: ExtractedPlayerEntry[];
  skippedCount: number;
  issues: UpdateProcessingIssue[];
}

function toInvalidPlayerIssue(
  recordKey: string,
  missingField: string,
): UpdateProcessingIssue {
  return createUpdateIssue({
    code: "invalid_player_record",
    message: `Player fragment is missing required field: ${missingField}.`,
    recoverable: true,
    stage: "validation",
    recordKey,
  });
}

function toPlayerNameConflictIssue(
  playerId: string,
  existingName: string,
  incomingName: string,
): UpdateProcessingIssue {
  return createUpdateIssue({
    code: "player_name_conflict",
    message:
      `Player ${playerId} has conflicting names: "${existingName}" vs "${incomingName}".`,
    recoverable: true,
    stage: "matching",
    recordKey: `player:${playerId}`,
  });
}

function selectCanonicalPlayer(
  existingPlayer: Player,
  incomingPlayer: Player,
): Player {
  if (existingPlayer.playerName === incomingPlayer.playerName) {
    return existingPlayer;
  }

  if (incomingPlayer.playerName.length > existingPlayer.playerName.length) {
    return incomingPlayer;
  }

  if (incomingPlayer.playerName.length < existingPlayer.playerName.length) {
    return existingPlayer;
  }

  return incomingPlayer.playerName.localeCompare(existingPlayer.playerName) < 0
    ? incomingPlayer
    : existingPlayer;
}

function buildPlayerRecordKey(
  competitionId: string,
  sourceRecord: DiscGolfMetrixSourceRecord,
  index: number,
): string {
  const fragment = parseResultPlayerFragment(sourceRecord);

  if (fragment.playerId) {
    return `player:${fragment.playerId}`;
  }

  return `competition:${competitionId}:player-index-${index}`;
}

export function mapDiscGolfMetrixPlayerRecord(
  sourceRecord: DiscGolfMetrixSourceRecord,
  context: {
    competitionId: string;
    metrixId: string | null;
    index: number;
  },
):
  | { ok: true; entry: ExtractedPlayerEntry }
  | { ok: false; issue: UpdateProcessingIssue } {
  const fragment = parseResultPlayerFragment(sourceRecord);
  const recordKey = buildPlayerRecordKey(
    context.competitionId,
    sourceRecord,
    context.index,
  );

  if (!fragment.playerId) {
    return { ok: false, issue: toInvalidPlayerIssue(recordKey, "playerId") };
  }

  if (!fragment.playerName) {
    return { ok: false, issue: toInvalidPlayerIssue(recordKey, "playerName") };
  }

  return {
    ok: true,
    entry: {
      competitionId: context.competitionId,
      metrixId: context.metrixId,
      player: {
        playerId: fragment.playerId,
        playerName: fragment.playerName,
      },
      sourceRecord,
    },
  };
}

export function mapDiscGolfMetrixPlayersFromResults(
  payloads: readonly DiscGolfMetrixResultsResponse[],
): PlayersFromResultsMappingResult {
  const playersById = new Map<string, Player>();
  const extractedPlayers: ExtractedPlayerEntry[] = [];
  const issues: UpdateProcessingIssue[] = [];
  let skippedCount = 0;

  payloads.forEach((payload) => {
    const records = readResultEntries(payload.rawPayload);

    records.forEach((sourceRecord, index) => {
      const fragment = parseResultPlayerFragment(sourceRecord);

      if (!fragment.playerId) {
        skippedCount += 1;
        return;
      }

      const mapped = mapDiscGolfMetrixPlayerRecord(sourceRecord, {
        competitionId: payload.competitionId,
        metrixId: payload.metrixId,
        index: index + 1,
      });

      if (!mapped.ok) {
        skippedCount += 1;
        issues.push(mapped.issue);
        return;
      }

      extractedPlayers.push(mapped.entry);
      const existingPlayer = playersById.get(mapped.entry.player.playerId);

      if (!existingPlayer) {
        playersById.set(mapped.entry.player.playerId, mapped.entry.player);
        return;
      }

      if (existingPlayer.playerName !== mapped.entry.player.playerName) {
        issues.push(
          toPlayerNameConflictIssue(
            mapped.entry.player.playerId,
            existingPlayer.playerName,
            mapped.entry.player.playerName,
          ),
        );
      }

      playersById.set(
        mapped.entry.player.playerId,
        selectCanonicalPlayer(existingPlayer, mapped.entry.player),
      );
    });
  });

  return {
    players: Array.from(playersById.values()),
    extractedPlayers,
    skippedCount,
    issues,
  };
}
