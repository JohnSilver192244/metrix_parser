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
    orderNumber: number,
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
    options?: { overwriteExisting?: boolean },
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
  return `${result.competitionId}::${result.playerId}::${result.orderNumber}`;
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

    if (!Number.isInteger(result.orderNumber)) {
      return {
        action: "skipped",
        matchedExisting: false,
        issue: createCompetitionResultIssue(
          "competition_result_missing_order",
          "Перед сохранением у результата должен быть orderNumber.",
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
      result.orderNumber,
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
      let summary = createEmptyUpdateSummary();
      const issues: UpdateProcessingIssue[] = [];
      const validRecords: PersistableCompetitionResultRecord[] = [];

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

      if (validRecords.length === 0) {
        return { summary, issues };
      }

      try {
        const competitionIds = [
          ...new Set(validRecords.map((record) => record.result.competitionId)),
        ];
        const existingRows = await adapter.findByCompetitionIds(competitionIds);
        const existingRowsByIdentity = new Map<string, CompetitionResultRow>(
          existingRows.map((row) => [
            `${row.competition_id}::${row.player_id}::${row.order_number}`,
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

        if (recordsToUpsert.length > 0) {
          await adapter.upsert(
            recordsToUpsert.map((record) => toStoredCompetitionResultRecord(record)),
          );
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
      } catch {
        for (const record of validRecords) {
          const normalized = normalizeRecordResult(
            await saveCompetitionResult(record, options),
          );
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

  if (!Number.isInteger(result.orderNumber)) {
    return {
      action: "skipped",
      matchedExisting: false,
      issue: createCompetitionResultIssue(
        "competition_result_missing_order",
        "Перед сохранением у результата должен быть orderNumber.",
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
