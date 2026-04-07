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
  savePlayer(
    record: PersistablePlayerRecord,
    options?: { overwriteExisting?: boolean },
  ): Promise<UpdateRecordResult>;
  savePlayers(
    records: PersistablePlayerRecord[],
    options?: { overwriteExisting?: boolean },
  ): Promise<{
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
  const {
    division: _ignoredDivision,
    rdga: _ignoredRdga,
    rdgaSince: _ignoredRdgaSince,
    seasonDivision: _ignoredSeasonDivision,
    ...playerDbRecord
  } = toPlayerDbRecord(record.player);

  return {
    ...playerDbRecord,
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
  async function savePlayer(
    record: PersistablePlayerRecord,
    options: { overwriteExisting?: boolean } = {},
  ): Promise<UpdateRecordResult> {
    const recordKey = `player:${record.player.playerId || "unknown"}`;

    if (record.player.playerId.trim().length === 0) {
      return {
        action: "skipped",
        matchedExisting: false,
        issue: createPlayerIssue(
          "player_missing_identity",
          "Перед сохранением у игрока должен быть playerId.",
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
          "Перед сохранением у игрока должен быть playerName.",
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

    if (options.overwriteExisting !== true) {
      return {
        action: "skipped",
        matchedExisting: true,
      };
    }

    await adapter.update(existingRow.id, {
      ...dbRecord,
      division: existingRow.division ?? null,
      rdga: existingRow.rdga ?? null,
      rdga_since: existingRow.rdga_since ?? null,
      season_division: existingRow.season_division ?? null,
    });

    return {
      action: resolveRecordAction(true),
      matchedExisting: true,
    };
  }

  return {
    savePlayer,
    async savePlayers(records, options = {}) {
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
        const recordsToUpsert = validRecords.filter(
          (record) =>
            options.overwriteExisting === true ||
            !existingRowsByPlayerId.has(record.player.playerId),
        );

        if (recordsToUpsert.length > 0) {
          await adapter.upsert(
            recordsToUpsert.map((record) => {
              const existingRow = existingRowsByPlayerId.get(record.player.playerId);
              const dbRecord = toStoredPlayerRecord(record);

              return existingRow
                ? {
                    ...dbRecord,
                    division: existingRow.division ?? null,
                    rdga: existingRow.rdga ?? null,
                    rdga_since: existingRow.rdga_since ?? null,
                    season_division: existingRow.season_division ?? null,
                  }
                : dbRecord;
            }),
          );
        }

        for (const record of validRecords) {
          const matchedExisting = existingRowsByPlayerId.has(record.player.playerId);
          summary = accumulateUpdateSummary(summary, {
            action: matchedExisting
              ? (options.overwriteExisting === true ? "updated" : "skipped")
              : "created",
            matchedExisting,
          });
        }

        return { summary, issues };
      } catch {
        for (const record of validRecords) {
          const normalized = normalizeRecordResult(await savePlayer(record, options));
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
        "Перед сохранением у игрока должен быть playerId.",
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
