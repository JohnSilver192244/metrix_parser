import {
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
}

export interface CompetitionsPersistenceAdapter {
  findByCompetitionId(competitionId: string): Promise<CompetitionRow | null>;
  findByMetrixId(metrixId: string): Promise<CompetitionRow | null>;
  insert(record: StoredCompetitionRecord): Promise<CompetitionRow>;
  update(id: number, record: StoredCompetitionRecord): Promise<CompetitionRow>;
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

export interface CompetitionsRepository {
  saveCompetition(record: PersistableCompetitionRecord): Promise<UpdateRecordResult>;
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
  return {
    ...toCompetitionDbRecord(record.competition),
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
    metrix_id: record.metrix_id ?? existingRow.metrix_id,
  };
}

export function createCompetitionsRepository(
  adapter: CompetitionsPersistenceAdapter,
): CompetitionsRepository {
  return {
    async saveCompetition(record) {
      const { competition } = record;
      const recordKey = buildRecordKey(competition);

      if (isBlank(competition.competitionId) && isBlank(competition.metrixId)) {
        return {
          action: "skipped",
          matchedExisting: false,
          issue: createCompetitionIssue(
            "competition_missing_identity",
            "Competition record must include competitionId or metrixId before persistence.",
            "validation",
            recordKey,
          ),
        };
      }

      const existingByCompetitionId = isBlank(competition.competitionId)
        ? null
        : await adapter.findByCompetitionId(competition.competitionId);
      const existingByMetrixId = isBlank(competition.metrixId)
        ? null
        : await adapter.findByMetrixId(competition.metrixId as string);

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
            "Competition record matches different rows by competition_id and metrix_id.",
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

      await adapter.update(existingRow.id, mergeWithExistingCompetitionRow(existingRow, dbRecord));

      return {
        action: resolveRecordAction(true),
        matchedExisting: true,
      };
    },
  };
}
