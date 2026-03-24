import {
  accumulateUpdateSummary,
  createEmptyUpdateSummary,
  createUpdateIssue,
  resolveRecordAction,
  toPlayerDbRecord,
  type Player,
  type PlayerDbRecord,
  type UpdateProcessingIssue,
  type UpdateRecordResult,
} from "@metrix-parser/shared-types";

export interface PlayerRow extends PlayerDbRecord {
  id: number;
  raw_payload: Record<string, unknown> | null;
  source_fetched_at: string | null;
}

export interface StoredPlayerRecord extends PlayerDbRecord {
  raw_payload: Record<string, unknown> | null;
  source_fetched_at: string | null;
}

export interface PersistablePlayerRecord {
  player: Player;
  rawPayload: Record<string, unknown> | null;
  sourceFetchedAt: string | null;
}

export interface PlayersPersistenceAdapter {
  findByPlayerId(playerId: string): Promise<PlayerRow | null>;
  findByPlayerIds(playerIds: string[]): Promise<PlayerRow[]>;
  insert(record: StoredPlayerRecord): Promise<PlayerRow>;
  update(id: number, record: StoredPlayerRecord): Promise<PlayerRow>;
  upsert(records: StoredPlayerRecord[]): Promise<PlayerRow[]>;
}

export interface PlayersRepository {
  savePlayer(record: PersistablePlayerRecord): Promise<UpdateRecordResult>;
  savePlayers(records: PersistablePlayerRecord[]): Promise<{
    summary: ReturnType<typeof createEmptyUpdateSummary>;
    issues: UpdateProcessingIssue[];
  }>;
}

function createPlayerIssue(
  code: string,
  message: string,
  stage: UpdateProcessingIssue["stage"],
  recordKey: string,
): UpdateProcessingIssue {
  return createUpdateIssue({
    code,
    message,
    recoverable: true,
    stage,
    recordKey,
  });
}

function toStoredPlayerRecord(record: PersistablePlayerRecord): StoredPlayerRecord {
  return {
    ...toPlayerDbRecord(record.player),
    raw_payload: record.rawPayload,
    source_fetched_at: record.sourceFetchedAt,
  };
}

function normalizeRecordResult(recordResult: UpdateRecordResult): UpdateRecordResult {
  return recordResult.issue && recordResult.action !== "skipped"
    ? { ...recordResult, action: "skipped" as const }
    : recordResult;
}

export function createPlayersRepository(
  adapter: PlayersPersistenceAdapter,
): PlayersRepository {
  async function savePlayer(record: PersistablePlayerRecord): Promise<UpdateRecordResult> {
    const recordKey = `player:${record.player.playerId || "unknown"}`;

    if (record.player.playerId.trim().length === 0) {
      return {
        action: "skipped",
        matchedExisting: false,
        issue: createPlayerIssue(
          "player_missing_identity",
          "Player record must include playerId before persistence.",
          "validation",
          recordKey,
        ),
      };
    }

    if (record.player.playerName.trim().length === 0) {
      return {
        action: "skipped",
        matchedExisting: false,
        issue: createPlayerIssue(
          "player_missing_name",
          "Player record must include playerName before persistence.",
          "validation",
          recordKey,
        ),
      };
    }

    const existingRow = await adapter.findByPlayerId(record.player.playerId);
    const dbRecord = toStoredPlayerRecord(record);

    if (!existingRow) {
      await adapter.insert(dbRecord);

      return {
        action: "created",
        matchedExisting: false,
      };
    }

    await adapter.update(existingRow.id, {
      ...dbRecord,
      division: existingRow.division ?? null,
      rdga: existingRow.rdga ?? null,
    });

    return {
      action: resolveRecordAction(true),
      matchedExisting: true,
    };
  }

  return {
    savePlayer,
    async savePlayers(records) {
      let summary = createEmptyUpdateSummary();
      const issues: UpdateProcessingIssue[] = [];
      const validRecords: PersistablePlayerRecord[] = [];

      for (const record of records) {
        const normalized = normalizeRecordResult(await savePlayerValidation(record));

        if (normalized.action === "skipped") {
          summary = accumulateUpdateSummary(summary, normalized);

          if (normalized.issue) {
            issues.push(normalized.issue);
          }
          continue;
        }

        validRecords.push(record);
      }

      if (validRecords.length === 0) {
        return { summary, issues };
      }

      try {
        const playerIds = [...new Set(validRecords.map((record) => record.player.playerId))];
        const existingRows = await adapter.findByPlayerIds(playerIds);
        const existingRowsByPlayerId = new Map(
          existingRows.map((row) => [row.player_id, row] as const),
        );

        await adapter.upsert(
          validRecords.map((record) => {
            const existingRow = existingRowsByPlayerId.get(record.player.playerId);
            const dbRecord = toStoredPlayerRecord(record);

            return existingRow
              ? {
                  ...dbRecord,
                  division: existingRow.division ?? null,
                  rdga: existingRow.rdga ?? null,
                }
              : dbRecord;
          }),
        );

        for (const record of validRecords) {
          summary = accumulateUpdateSummary(summary, {
            action: existingRowsByPlayerId.has(record.player.playerId)
              ? "updated"
              : "created",
            matchedExisting: existingRowsByPlayerId.has(record.player.playerId),
          });
        }

        return { summary, issues };
      } catch {
        for (const record of validRecords) {
          const normalized = normalizeRecordResult(await savePlayer(record));
          summary = accumulateUpdateSummary(summary, normalized);

          if (normalized.issue) {
            issues.push(normalized.issue);
          }
        }

        return { summary, issues };
      }
    },
  };
}

async function savePlayerValidation(
  record: PersistablePlayerRecord,
): Promise<UpdateRecordResult> {
  const recordKey = `player:${record.player.playerId || "unknown"}`;

  if (record.player.playerId.trim().length === 0) {
    return {
      action: "skipped",
      matchedExisting: false,
      issue: createPlayerIssue(
        "player_missing_identity",
        "Player record must include playerId before persistence.",
        "validation",
        recordKey,
      ),
    };
  }

  if (record.player.playerName.trim().length === 0) {
    return {
      action: "skipped",
      matchedExisting: false,
      issue: createPlayerIssue(
        "player_missing_name",
        "Player record must include playerName before persistence.",
        "validation",
        recordKey,
      ),
    };
  }

  return {
    action: "updated",
    matchedExisting: false,
  };
}
