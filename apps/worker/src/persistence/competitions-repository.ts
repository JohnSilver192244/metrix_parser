import {
  accumulateUpdateSummary,
  createEmptyUpdateSummary,
  createUpdateIssue,
  resolveRecordAction,
  toCompetitionDbRecord,
  type Competition,
  type CompetitionDbRecord,
  type UpdateProcessingIssue,
  type UpdateRecordResult,
} from "@metrix-parser/shared-types";

export interface CompetitionRow extends CompetitionDbRecord {
  id: number;
  raw_payload?: Record<string, unknown> | null;
  source_fetched_at?: string | null;
}

export interface CompetitionsPersistenceAdapter {
  findByCompetitionId(competitionId: string): Promise<CompetitionRow | null>;
  findByMetrixId(metrixId: string): Promise<CompetitionRow | null>;
  findByCompetitionIds(competitionIds: string[]): Promise<CompetitionRow[]>;
  findByMetrixIds(metrixIds: string[]): Promise<CompetitionRow[]>;
  insert(record: StoredCompetitionRecord): Promise<CompetitionRow>;
  update(id: number, record: StoredCompetitionRecord): Promise<CompetitionRow>;
  upsert(records: StoredCompetitionRecord[]): Promise<CompetitionRow[]>;
}

function buildRecordKey(competition: Competition): string {
  return `competition:${competition.competitionId || competition.metrixId || "unknown"}`;
}

function isBlank(value: string | null): boolean {
  return value === null || value.trim().length === 0;
}

function createCompetitionIssue(
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

function createCompetitionSkipReason(
  message: string,
  recordKey: string,
): UpdateProcessingIssue {
  return createUpdateIssue({
    code: "competition_existing_record_skipped",
    message,
    recoverable: true,
    stage: "matching",
    recordKey,
  });
}

export interface CompetitionsRepository {
  preloadExisting(
    records: readonly PersistableCompetitionRecord[],
  ): Promise<CompetitionExistingIndex>;
  saveCompetition(
    record: PersistableCompetitionRecord,
    options?: {
      overwriteExisting?: boolean;
      existingIndex?: CompetitionExistingIndex;
    },
  ): Promise<UpdateRecordResult>;
  saveCompetitions(
    records: PersistableCompetitionRecord[],
    options?: { overwriteExisting?: boolean },
  ): Promise<{
    summary: ReturnType<typeof createEmptyUpdateSummary>;
    issues: UpdateProcessingIssue[];
    skipReasons: UpdateProcessingIssue[];
  }>;
}

export interface CompetitionExistingIndex {
  byCompetitionId: ReadonlyMap<string, CompetitionRow>;
  byMetrixId: ReadonlyMap<string, CompetitionRow>;
}

export interface PersistableCompetitionRecord {
  competition: Competition;
  rawPayload: Record<string, unknown> | null;
  sourceFetchedAt: string | null;
}

export interface StoredCompetitionRecord extends CompetitionDbRecord {
  raw_payload: Record<string, unknown> | null;
  source_fetched_at: string | null;
}

function toStoredCompetitionRecord(
  record: PersistableCompetitionRecord,
): StoredCompetitionRecord {
  const {
    category_id: _ignoredCategoryId,
    ...competitionDbRecord
  } = toCompetitionDbRecord(record.competition);

  return {
    ...competitionDbRecord,
    raw_payload: record.rawPayload,
    source_fetched_at: record.sourceFetchedAt,
  };
}

function mergeWithExistingCompetitionRow(
  existingRow: CompetitionRow,
  record: StoredCompetitionRecord,
): StoredCompetitionRecord {
  return {
    ...record,
    category_id: existingRow.category_id ?? null,
    metrix_id: record.metrix_id ?? existingRow.metrix_id,
  };
}

function createEmptyExistingIndex(): CompetitionExistingIndex {
  return {
    byCompetitionId: new Map(),
    byMetrixId: new Map(),
  };
}

function normalizeRecordResult(recordResult: UpdateRecordResult): UpdateRecordResult {
  return recordResult.issue && recordResult.action !== "skipped"
    ? { ...recordResult, action: "skipped" as const }
    : recordResult;
}

function hasSamePayload(
  left: Record<string, unknown> | null | undefined,
  right: Record<string, unknown> | null | undefined,
): boolean {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function isStoredCompetitionRecordUnchanged(
  existingRow: CompetitionRow,
  nextRecord: StoredCompetitionRecord,
): boolean {
  return (
    existingRow.competition_id === nextRecord.competition_id &&
    existingRow.competition_name === nextRecord.competition_name &&
    existingRow.competition_date === nextRecord.competition_date &&
    (existingRow.parent_id ?? null) === (nextRecord.parent_id ?? null) &&
    (existingRow.course_id ?? null) === (nextRecord.course_id ?? null) &&
    (existingRow.course_name ?? null) === (nextRecord.course_name ?? null) &&
    (existingRow.category_id ?? null) === (nextRecord.category_id ?? null) &&
    (existingRow.record_type ?? null) === (nextRecord.record_type ?? null) &&
    (existingRow.players_count ?? null) === (nextRecord.players_count ?? null) &&
    (existingRow.metrix_id ?? null) === (nextRecord.metrix_id ?? null) &&
    (existingRow.source_fetched_at ?? null) === (nextRecord.source_fetched_at ?? null) &&
    hasSamePayload(existingRow.raw_payload, nextRecord.raw_payload)
  );
}

export function createCompetitionsRepository(
  adapter: CompetitionsPersistenceAdapter,
): CompetitionsRepository {
  async function preloadExisting(
    records: readonly PersistableCompetitionRecord[],
  ): Promise<CompetitionExistingIndex> {
      const competitionIds = new Set<string>();
      const metrixIds = new Set<string>();

      records.forEach(({ competition }) => {
        if (!isBlank(competition.competitionId)) {
          competitionIds.add(competition.competitionId);
        }

        if (!isBlank(competition.metrixId)) {
          metrixIds.add(competition.metrixId as string);
        }
      });

      const [rowsByCompetitionId, rowsByMetrixId] = await Promise.all([
        adapter.findByCompetitionIds([...competitionIds]),
        adapter.findByMetrixIds([...metrixIds]),
      ]);

      return {
        byCompetitionId: new Map(
          rowsByCompetitionId.map((row) => [row.competition_id, row]),
        ),
        byMetrixId: new Map(
          rowsByMetrixId
            .filter((row) => !isBlank(row.metrix_id))
            .map((row) => [row.metrix_id as string, row]),
        ),
      };
  }

  async function saveCompetition(
    record: PersistableCompetitionRecord,
    options: {
      overwriteExisting?: boolean;
      existingIndex?: CompetitionExistingIndex;
    } = {},
  ): Promise<UpdateRecordResult> {
      const { competition } = record;
      const recordKey = buildRecordKey(competition);

      if (isBlank(competition.competitionId) && isBlank(competition.metrixId)) {
        return {
          action: "skipped",
          matchedExisting: false,
          issue: createCompetitionIssue(
            "competition_missing_identity",
            "Перед сохранением у соревнования должен быть competitionId или metrixId.",
            "validation",
            recordKey,
          ),
        };
      }

      const existingIndex = options.existingIndex ?? createEmptyExistingIndex();
      const existingByCompetitionId = isBlank(competition.competitionId)
        ? null
        : (existingIndex.byCompetitionId.get(competition.competitionId) ??
          (await adapter.findByCompetitionId(competition.competitionId)));
      const existingByMetrixId = isBlank(competition.metrixId)
        ? null
        : (existingIndex.byMetrixId.get(competition.metrixId as string) ??
          (await adapter.findByMetrixId(competition.metrixId as string)));

      if (
        existingByCompetitionId &&
        existingByMetrixId &&
        existingByCompetitionId.id !== existingByMetrixId.id
      ) {
        return {
          action: "skipped",
          matchedExisting: false,
          issue: createCompetitionIssue(
            "competition_identity_conflict",
            "Запись соревнования совпала с разными строками по competition_id и metrix_id.",
            "matching",
            recordKey,
          ),
        };
      }

      const existingRow = existingByCompetitionId ?? existingByMetrixId;
      const dbRecord = toStoredCompetitionRecord(record);

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
          skipReason: createCompetitionSkipReason(
            "Запись уже существует, а перезапись имеющихся данных выключена.",
            recordKey,
          ),
        };
      }

      const mergedRecord = mergeWithExistingCompetitionRow(existingRow, dbRecord);

      if (isStoredCompetitionRecordUnchanged(existingRow, mergedRecord)) {
        return {
          action: "skipped",
          matchedExisting: true,
          skipReason: createUpdateIssue({
            code: "competition_unchanged_skipped",
            message: "Запись уже актуальна, обновление не потребовалось.",
            recoverable: true,
            stage: "matching",
            recordKey,
          }),
        };
      }

      await adapter.update(existingRow.id, mergedRecord);

      return {
        action: resolveRecordAction(true),
        matchedExisting: true,
      };
  }

  return {
    preloadExisting,
    saveCompetition,
    async saveCompetitions(records, options = {}) {
      let summary = createEmptyUpdateSummary();
      const issues: UpdateProcessingIssue[] = [];
      const skipReasons: UpdateProcessingIssue[] = [];
      const validRecords: PersistableCompetitionRecord[] = [];

      for (const record of records) {
        const normalized = normalizeRecordResult(await saveCompetitionValidation(record));

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
        return { summary, issues, skipReasons };
      }

      const validationSummary = { ...summary };
      const validationIssues = [...issues];
      const validationSkipReasons = [...skipReasons];

      try {
        const existingIndex = await preloadExisting(validRecords);
        const recordsToUpsert: StoredCompetitionRecord[] = [];

        for (const record of validRecords) {
          const { competition } = record;
          const recordKey = buildRecordKey(competition);
          const existingByCompetitionId = isBlank(competition.competitionId)
            ? null
            : (existingIndex.byCompetitionId.get(competition.competitionId) ?? null);
          const existingByMetrixId = isBlank(competition.metrixId)
            ? null
            : (existingIndex.byMetrixId.get(competition.metrixId as string) ?? null);

          if (
            existingByCompetitionId &&
            existingByMetrixId &&
            existingByCompetitionId.id !== existingByMetrixId.id
          ) {
            const issue = createCompetitionIssue(
              "competition_identity_conflict",
              "Запись соревнования совпала с разными строками по competition_id и metrix_id.",
              "matching",
              recordKey,
            );

            summary = accumulateUpdateSummary(summary, {
              action: "skipped",
              matchedExisting: false,
              issue,
            });
            issues.push(issue);
            continue;
          }

          const existingRow = existingByCompetitionId ?? existingByMetrixId;
          const dbRecord = toStoredCompetitionRecord(record);

          if (!existingRow) {
            recordsToUpsert.push(dbRecord);
            summary = accumulateUpdateSummary(summary, {
              action: "created",
              matchedExisting: false,
            });
            continue;
          }

          if (options.overwriteExisting !== true) {
            const skipReason = createCompetitionSkipReason(
              "Запись уже существует, а перезапись имеющихся данных выключена.",
              recordKey,
            );

            summary = accumulateUpdateSummary(summary, {
              action: "skipped",
              matchedExisting: true,
              skipReason,
            });
            skipReasons.push(skipReason);
            continue;
          }

          const mergedRecord = mergeWithExistingCompetitionRow(existingRow, dbRecord);

          if (isStoredCompetitionRecordUnchanged(existingRow, mergedRecord)) {
            const skipReason = createUpdateIssue({
              code: "competition_unchanged_skipped",
              message: "Запись уже актуальна, обновление не потребовалось.",
              recoverable: true,
              stage: "matching",
              recordKey,
            });

            summary = accumulateUpdateSummary(summary, {
              action: "skipped",
              matchedExisting: true,
              skipReason,
            });
            skipReasons.push(skipReason);
            continue;
          }

          recordsToUpsert.push(mergedRecord);
          summary = accumulateUpdateSummary(summary, {
            action: "updated",
            matchedExisting: true,
          });
        }

        if (recordsToUpsert.length > 0) {
          await adapter.upsert(recordsToUpsert);
        }

        return { summary, issues, skipReasons };
      } catch {
        summary = { ...validationSummary };
        issues.length = 0;
        issues.push(...validationIssues);
        skipReasons.length = 0;
        skipReasons.push(...validationSkipReasons);

        for (const record of validRecords) {
          const normalized = normalizeRecordResult(await saveCompetition(record, options));
          summary = accumulateUpdateSummary(summary, normalized);

          if (normalized.issue) {
            issues.push(normalized.issue);
          }

          if (normalized.skipReason) {
            skipReasons.push(normalized.skipReason);
          }
        }

        return { summary, issues, skipReasons };
      }
    },
  };
}

async function saveCompetitionValidation(
  record: PersistableCompetitionRecord,
): Promise<UpdateRecordResult> {
  const recordKey = buildRecordKey(record.competition);

  if (
    isBlank(record.competition.competitionId) &&
    isBlank(record.competition.metrixId)
  ) {
    return {
      action: "skipped",
      matchedExisting: false,
      issue: createCompetitionIssue(
        "competition_missing_identity",
        "Перед сохранением у соревнования должен быть competitionId или metrixId.",
        "validation",
        recordKey,
      ),
    };
  }

  return {
    action: "created",
    matchedExisting: false,
  };
}
