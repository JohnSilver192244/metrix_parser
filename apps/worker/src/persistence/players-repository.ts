import {
  accumulateUpdateSummary,
  createEmptyUpdateSummary,
  createUpdateIssue,
  resolveRecordAction,
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
    options?: { overwriteExisting?: boolean; jobId?: string },
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
  recoverable = true,
): UpdateProcessingIssue {
  return createUpdateIssue({
    code,
    message,
    recoverable,
    stage,
    recordKey,
  });
}

const PLAYERS_WRITE_ALLOWLIST: ReadonlySet<keyof StoredPlayerRecord> = new Set([
  "player_id",
  "player_name",
  "division",
  "rdga",
  "rdga_since",
  "season_division",
  "raw_payload",
  "source_fetched_at",
]);

function toStoredPlayerRecord(record: PersistablePlayerRecord): StoredPlayerRecord {
  const candidate: PlayerDbRecord = {
    player_id: record.player.playerId,
    player_name: record.player.playerName,
    division: record.player.division,
    rdga: record.player.rdga,
    rdga_since: record.player.rdgaSince,
    season_division: record.player.seasonDivision,
    season_points: record.player.seasonPoints,
    season_credit_points: record.player.seasonCreditPoints,
    competitions_count: record.player.competitionsCount,
    season_credit_competitions: record.player.seasonCreditCompetitions,
  };

  const storedRecord: StoredPlayerRecord = {
    player_id: candidate.player_id,
    player_name: candidate.player_name,
    raw_payload: record.rawPayload,
    source_fetched_at: record.sourceFetchedAt,
  };

  if (candidate.division !== undefined) {
    storedRecord.division = candidate.division;
  }
  if (candidate.rdga !== undefined) {
    storedRecord.rdga = candidate.rdga;
  }
  if (candidate.rdga_since !== undefined) {
    storedRecord.rdga_since = candidate.rdga_since;
  }
  if (candidate.season_division !== undefined) {
    storedRecord.season_division = candidate.season_division;
  }

  return sanitizeStoredPlayerRecord(storedRecord);
}

function sanitizeStoredPlayerRecord(record: StoredPlayerRecord): StoredPlayerRecord {
  const sanitized: StoredPlayerRecord = {
    player_id: record.player_id,
    player_name: record.player_name,
    raw_payload: record.raw_payload,
    source_fetched_at: record.source_fetched_at,
  };
  const mutableSanitized = sanitized as unknown as Record<string, unknown>;

  for (const [key, value] of Object.entries(record)) {
    if (
      PLAYERS_WRITE_ALLOWLIST.has(key as keyof StoredPlayerRecord) &&
      value !== undefined
    ) {
      mutableSanitized[key] = value;
    }
  }

  return sanitized;
}

function isPlayersSchemaMismatchError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  return (
    normalized.includes("schema cache") &&
    normalized.includes("players") &&
    normalized.includes("column")
  );
}

function isTransientPersistenceError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  return [
    "timeout",
    "timed out",
    "econnreset",
    "econnrefused",
    "ehostunreach",
    "enotfound",
    "fetch failed",
    "network",
    "temporary failure",
  ].some((marker) => normalized.includes(marker));
}

function markBatchPersistenceFailure(
  summary: ReturnType<typeof createEmptyUpdateSummary>,
  recordsCount: number,
) {
  return {
    ...summary,
    found: summary.found + recordsCount,
    skipped: summary.skipped + recordsCount,
    errors: summary.errors + recordsCount,
  };
}

function normalizeRecordResult(recordResult: UpdateRecordResult): UpdateRecordResult {
  return recordResult.issue && recordResult.action !== "skipped"
    ? { ...recordResult, action: "skipped" as const }
    : recordResult;
}

function logPlayersRepositoryTiming(input: {
  jobId: string;
  operation: string;
  durationMs: number;
  validRecords: number;
  recordsToUpsert: number;
  fallbackUsed: boolean;
  error?: unknown;
}): void {
  const payload = {
    jobId: input.jobId,
    operation: input.operation,
    durationMs: input.durationMs,
    validRecords: input.validRecords,
    recordsToUpsert: input.recordsToUpsert,
    fallbackUsed: input.fallbackUsed,
  };

  if (input.error) {
    console.error("[players-repository]", {
      ...payload,
      error:
        input.error instanceof Error ? input.error.message : String(input.error),
    });
    return;
  }

  console.info("[players-repository]", payload);
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
      const jobId = options.jobId ?? "unknown";
      let summary = createEmptyUpdateSummary();
      const issues: UpdateProcessingIssue[] = [];
      const validRecords: PersistablePlayerRecord[] = [];
      let recordsToUpsertCount = 0;

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

      logPlayersRepositoryTiming({
        jobId,
        operation: "savePlayers.validation",
        durationMs: 0,
        validRecords: validRecords.length,
        recordsToUpsert: 0,
        fallbackUsed: false,
      });

      if (validRecords.length === 0) {
        return { summary, issues };
      }

      try {
        const playerIds = [...new Set(validRecords.map((record) => record.player.playerId))];
        const findStartedAtMs = Date.now();
        const existingRows = await adapter.findByPlayerIds(playerIds);
        logPlayersRepositoryTiming({
          jobId,
          operation: "findByPlayerIds",
          durationMs: Date.now() - findStartedAtMs,
          validRecords: validRecords.length,
          recordsToUpsert: 0,
          fallbackUsed: false,
        });
        const existingRowsByPlayerId = new Map(
          existingRows.map((row) => [row.player_id, row] as const),
        );
        const recordsToUpsert = validRecords.filter(
          (record) =>
            options.overwriteExisting === true ||
            !existingRowsByPlayerId.has(record.player.playerId),
        );
        recordsToUpsertCount = recordsToUpsert.length;

        if (recordsToUpsert.length > 0) {
          const upsertStartedAtMs = Date.now();
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
          logPlayersRepositoryTiming({
            jobId,
            operation: "upsert",
            durationMs: Date.now() - upsertStartedAtMs,
            validRecords: validRecords.length,
            recordsToUpsert: recordsToUpsertCount,
            fallbackUsed: false,
          });
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
      } catch (error) {
        if (isPlayersSchemaMismatchError(error)) {
          logPlayersRepositoryTiming({
            jobId,
            operation: "players_upsert_schema_mismatch",
            durationMs: 0,
            validRecords: validRecords.length,
            recordsToUpsert: recordsToUpsertCount,
            fallbackUsed: false,
            error,
          });

          issues.push(
            createPlayerIssue(
              "players_upsert_schema_mismatch",
              "Bulk upsert players failed because write payload does not match app_public.players schema.",
              "persistence",
              "players:bulk",
              false,
            ),
          );

          summary = markBatchPersistenceFailure(summary, validRecords.length);
          return { summary, issues };
        }

        if (!isTransientPersistenceError(error)) {
          logPlayersRepositoryTiming({
            jobId,
            operation: "bulk.upsert.non_transient.failed",
            durationMs: 0,
            validRecords: validRecords.length,
            recordsToUpsert: recordsToUpsertCount,
            fallbackUsed: false,
            error,
          });

          issues.push(
            createPlayerIssue(
              "players_bulk_upsert_failed",
              "Bulk upsert players failed with a non-transient error. Batch was stopped without per-record fallback.",
              "persistence",
              "players:bulk",
              false,
            ),
          );

          summary = markBatchPersistenceFailure(summary, validRecords.length);
          return { summary, issues };
        }

        logPlayersRepositoryTiming({
          jobId,
          operation: "bulk.upsert.failed",
          durationMs: 0,
          validRecords: validRecords.length,
          recordsToUpsert: recordsToUpsertCount,
          fallbackUsed: true,
          error,
        });

        const fallbackStartedAtMs = Date.now();
        for (const record of validRecords) {
          const normalized = normalizeRecordResult(await savePlayer(record, options));
          summary = accumulateUpdateSummary(summary, normalized);

          if (normalized.issue) {
            issues.push(normalized.issue);
          }
        }
        logPlayersRepositoryTiming({
          jobId,
          operation: "fallback.perRecord",
          durationMs: Date.now() - fallbackStartedAtMs,
          validRecords: validRecords.length,
          recordsToUpsert: recordsToUpsertCount,
          fallbackUsed: true,
        });

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
