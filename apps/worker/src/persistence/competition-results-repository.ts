import {
  accumulateUpdateSummary,
  createEmptyUpdateSummary,
  createUpdateIssue,
  resolveRecordAction,
  toCompetitionResultDbRecord,
  type CompetitionResult,
  type CompetitionResultDbRecord,
  type UpdateProcessingIssue,
  type UpdateRecordResult,
} from "@metrix-parser/shared-types";

export interface CompetitionResultRow extends CompetitionResultDbRecord {
  id: number;
  raw_payload: Record<string, unknown> | null;
  source_fetched_at: string | null;
}

export interface StoredCompetitionResultRecord
  extends Omit<CompetitionResultDbRecord, "season_points"> {
  raw_payload: Record<string, unknown> | null;
  source_fetched_at: string | null;
}

export interface PersistableCompetitionResultRecord {
  result: CompetitionResult;
  rawPayload: Record<string, unknown> | null;
  sourceFetchedAt: string | null;
}

export interface CompetitionResultsPersistenceAdapter {
  findByIdentity(
    competitionId: string,
    playerId: string,
  ): Promise<CompetitionResultRow | null>;
  findByCompetitionIds(competitionIds: string[]): Promise<CompetitionResultRow[]>;
  insert(record: StoredCompetitionResultRecord): Promise<CompetitionResultRow>;
  update(
    id: number,
    record: StoredCompetitionResultRecord,
  ): Promise<CompetitionResultRow>;
  upsert(records: StoredCompetitionResultRecord[]): Promise<CompetitionResultRow[]>;
}

export interface CompetitionResultsRepository {
  saveCompetitionResult(
    record: PersistableCompetitionResultRecord,
    options?: { overwriteExisting?: boolean },
  ): Promise<UpdateRecordResult>;
  saveCompetitionResults(
    records: PersistableCompetitionResultRecord[],
    options?: { overwriteExisting?: boolean; jobId?: string },
  ): Promise<{
    summary: ReturnType<typeof createEmptyUpdateSummary>;
    issues: UpdateProcessingIssue[];
  }>;
}

function createCompetitionResultIssue(
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

function toStoredCompetitionResultRecord(
  record: PersistableCompetitionResultRecord,
): StoredCompetitionResultRecord {
  const { season_points: _ignoredSeasonPoints, ...competitionResultDbRecord } =
    toCompetitionResultDbRecord(record.result);

  return {
    ...competitionResultDbRecord,
    raw_payload: record.rawPayload,
    source_fetched_at: record.sourceFetchedAt,
  };
}

function normalizeRecordResult(recordResult: UpdateRecordResult): UpdateRecordResult {
  return recordResult.issue && recordResult.action !== "skipped"
    ? { ...recordResult, action: "skipped" as const }
    : recordResult;
}

function buildResultIdentityKey(result: CompetitionResult): string {
  return `${result.competitionId}::${result.playerId}`;
}

function logCompetitionResultsRepositoryTiming(input: {
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
    console.error("[competition-results-repository]", {
      ...payload,
      error:
        input.error instanceof Error ? input.error.message : String(input.error),
    });
    return;
  }

  console.info("[competition-results-repository]", payload);
}

export function createCompetitionResultsRepository(
  adapter: CompetitionResultsPersistenceAdapter,
): CompetitionResultsRepository {
  async function saveCompetitionResult(
    record: PersistableCompetitionResultRecord,
    options: { overwriteExisting?: boolean } = {},
  ): Promise<UpdateRecordResult> {
    const { result } = record;
    const recordKey = `competition:${result.competitionId}:player:${result.playerId || "unknown"}`;

    if (result.competitionId.trim().length === 0 || result.playerId.trim().length === 0) {
      return {
        action: "skipped",
        matchedExisting: false,
        issue: createCompetitionResultIssue(
          "competition_result_missing_identity",
          "Перед сохранением у результата должны быть competitionId и playerId.",
          "validation",
          recordKey,
        ),
      };
    }

    if (!result.dnf && (result.sum === null || result.diff === null)) {
      return {
        action: "skipped",
        matchedExisting: false,
        issue: createCompetitionResultIssue(
          "competition_result_missing_score",
          "Для результата без DNF перед сохранением должны быть sum и diff.",
          "validation",
          recordKey,
        ),
      };
    }

    const existingRow = await adapter.findByIdentity(
      result.competitionId,
      result.playerId,
    );
    const dbRecord = toStoredCompetitionResultRecord(record);

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

    await adapter.update(existingRow.id, dbRecord);

    return {
      action: resolveRecordAction(true),
      matchedExisting: true,
    };
  }

  return {
    saveCompetitionResult,
    async saveCompetitionResults(records, options = {}) {
      const jobId = options.jobId ?? "unknown";
      let summary = createEmptyUpdateSummary();
      const issues: UpdateProcessingIssue[] = [];
      const validRecords: PersistableCompetitionResultRecord[] = [];
      let recordsToUpsertCount = 0;

      for (const record of records) {
        const normalized = normalizeRecordResult(await saveCompetitionResultValidation(record));

        if (normalized.action === "skipped") {
          summary = accumulateUpdateSummary(summary, normalized);

          if (normalized.issue) {
            issues.push(normalized.issue);
          }
          continue;
        }

        validRecords.push(record);
      }

      logCompetitionResultsRepositoryTiming({
        jobId,
        operation: "saveCompetitionResults.validation",
        durationMs: 0,
        validRecords: validRecords.length,
        recordsToUpsert: 0,
        fallbackUsed: false,
      });

      if (validRecords.length === 0) {
        return { summary, issues };
      }

      try {
        const competitionIds = [
          ...new Set(validRecords.map((record) => record.result.competitionId)),
        ];
        const findStartedAtMs = Date.now();
        const existingRows = await adapter.findByCompetitionIds(competitionIds);
        logCompetitionResultsRepositoryTiming({
          jobId,
          operation: "findByCompetitionIds",
          durationMs: Date.now() - findStartedAtMs,
          validRecords: validRecords.length,
          recordsToUpsert: 0,
          fallbackUsed: false,
        });
        const existingRowsByIdentity = new Map<string, CompetitionResultRow>(
          existingRows.map((row) => [
            `${row.competition_id}::${row.player_id}`,
            row,
          ]),
        );

        const recordsToUpsert = validRecords.filter((record) => {
          const identityKey = buildResultIdentityKey(record.result);

          return (
            options.overwriteExisting === true ||
            !existingRowsByIdentity.has(identityKey)
          );
        });
        recordsToUpsertCount = recordsToUpsert.length;

        if (recordsToUpsert.length > 0) {
          const upsertStartedAtMs = Date.now();
          await adapter.upsert(
            recordsToUpsert.map((record) => toStoredCompetitionResultRecord(record)),
          );
          logCompetitionResultsRepositoryTiming({
            jobId,
            operation: "upsert",
            durationMs: Date.now() - upsertStartedAtMs,
            validRecords: validRecords.length,
            recordsToUpsert: recordsToUpsertCount,
            fallbackUsed: false,
          });
        }

        for (const record of validRecords) {
          const identityKey = buildResultIdentityKey(record.result);
          const matchedExisting = existingRowsByIdentity.has(identityKey);

          summary = accumulateUpdateSummary(summary, {
            action: matchedExisting
              ? (options.overwriteExisting === true ? "updated" : "skipped")
              : "created",
            matchedExisting,
          });
        }

        return { summary, issues };
      } catch (error) {
        logCompetitionResultsRepositoryTiming({
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
          const normalized = normalizeRecordResult(
            await saveCompetitionResult(record, options),
          );
          summary = accumulateUpdateSummary(summary, normalized);

          if (normalized.issue) {
            issues.push(normalized.issue);
          }
        }
        logCompetitionResultsRepositoryTiming({
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

async function saveCompetitionResultValidation(
  record: PersistableCompetitionResultRecord,
): Promise<UpdateRecordResult> {
  const { result } = record;
  const recordKey = `competition:${result.competitionId}:player:${result.playerId || "unknown"}`;

  if (result.competitionId.trim().length === 0 || result.playerId.trim().length === 0) {
    return {
      action: "skipped",
      matchedExisting: false,
      issue: createCompetitionResultIssue(
        "competition_result_missing_identity",
        "Перед сохранением у результата должны быть competitionId и playerId.",
        "validation",
        recordKey,
      ),
    };
  }

  if (!result.dnf && (result.sum === null || result.diff === null)) {
    return {
      action: "skipped",
      matchedExisting: false,
      issue: createCompetitionResultIssue(
        "competition_result_missing_score",
        "Для результата без DNF перед сохранением должны быть sum и diff.",
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
