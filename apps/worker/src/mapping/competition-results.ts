import {
  createUpdateIssue,
  type CompetitionResult,
  type UpdateProcessingIssue,
} from "@metrix-parser/shared-types";

import type {
  DiscGolfMetrixResultsResponse,
  DiscGolfMetrixSourceRecord,
} from "../integration/discgolfmetrix";
import { parseCompetitionResultFragment } from "../parsing/competition-result";
import { readResultEntries } from "../parsing/result-player";

export interface ExtractedCompetitionResultEntry {
  competitionId: string;
  metrixId: string | null;
  result: CompetitionResult;
  sourceRecord: DiscGolfMetrixSourceRecord;
}

export interface CompetitionResultsMappingResult {
  results: CompetitionResult[];
  extractedResults: ExtractedCompetitionResultEntry[];
  skippedCount: number;
  issues: UpdateProcessingIssue[];
}

function toInvalidCompetitionResultIssue(
  recordKey: string,
  missingField: string,
): UpdateProcessingIssue {
  return createUpdateIssue({
    code: "invalid_competition_result_record",
    message: `Во фрагменте результата отсутствует обязательное поле: ${missingField}.`,
    recoverable: true,
    stage: "validation",
    recordKey,
  });
}

function buildCompetitionResultRecordKey(
  competitionId: string,
  sourceRecord: DiscGolfMetrixSourceRecord,
  index: number,
): string {
  const fragment = parseCompetitionResultFragment(sourceRecord);

  if (fragment.playerId) {
    return `competition:${competitionId}:player:${fragment.playerId}`;
  }

  return `competition:${competitionId}:result-index-${index}`;
}

export function mapDiscGolfMetrixCompetitionResultRecord(
  sourceRecord: DiscGolfMetrixSourceRecord,
  context: {
    competitionId: string;
    metrixId: string | null;
    index: number;
  },
):
  | { ok: true; entry: ExtractedCompetitionResultEntry }
  | { ok: false; issue: UpdateProcessingIssue } {
  const fragment = parseCompetitionResultFragment(sourceRecord);
  const recordKey = buildCompetitionResultRecordKey(
    context.competitionId,
    sourceRecord,
    context.index,
  );

  if (!fragment.playerId) {
    return { ok: false, issue: toInvalidCompetitionResultIssue(recordKey, "playerId") };
  }

  if (fragment.orderNumber === undefined) {
    return { ok: false, issue: toInvalidCompetitionResultIssue(recordKey, "orderNumber") };
  }

  if (!fragment.dnf && fragment.sum === undefined) {
    return { ok: false, issue: toInvalidCompetitionResultIssue(recordKey, "sum") };
  }

  if (!fragment.dnf && fragment.diff === undefined) {
    return { ok: false, issue: toInvalidCompetitionResultIssue(recordKey, "diff") };
  }

  return {
    ok: true,
    entry: {
      competitionId: context.competitionId,
      metrixId: context.metrixId,
      result: {
        competitionId: context.competitionId,
        playerId: fragment.playerId,
        className: fragment.className ?? null,
        sum: fragment.sum ?? null,
        diff: fragment.diff ?? null,
        orderNumber: fragment.orderNumber,
        dnf: fragment.dnf,
      },
      sourceRecord,
    },
  };
}

export function mapDiscGolfMetrixCompetitionResults(
  payloads: readonly DiscGolfMetrixResultsResponse[],
): CompetitionResultsMappingResult {
  const results: CompetitionResult[] = [];
  const extractedResults: ExtractedCompetitionResultEntry[] = [];
  const issues: UpdateProcessingIssue[] = [];
  let skippedCount = 0;

  payloads.forEach((payload) => {
    const records = readResultEntries(payload.rawPayload);

    records.forEach((sourceRecord, index) => {
      const fragment = parseCompetitionResultFragment(sourceRecord);

      if (!fragment.playerId) {
        skippedCount += 1;
        return;
      }

      const mapped = mapDiscGolfMetrixCompetitionResultRecord(sourceRecord, {
        competitionId: payload.competitionId,
        metrixId: payload.metrixId,
        index: index + 1,
      });

      if (!mapped.ok) {
        skippedCount += 1;
        issues.push(mapped.issue);
        return;
      }

      extractedResults.push(mapped.entry);
      results.push(mapped.entry.result);
    });
  });

  return {
    results,
    extractedResults,
    skippedCount,
    issues,
  };
}
