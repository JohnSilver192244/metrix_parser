import {
  createEmptyUpdateSummary,
  type UpdateFinalStatus,
  type UpdateOperationResult,
  type UpdatePeriod,
  type UpdateProcessingIssue,
} from "@metrix-parser/shared-types";

import {
  createDiscGolfMetrixClient,
  toDiscGolfMetrixIssue,
  type DiscGolfMetrixClientDependencies,
  type DiscGolfMetrixResultsResponse,
} from "../integration/discgolfmetrix";
import { createWorkerSupabaseAdminClient } from "../lib/supabase-admin";
import {
  mapDiscGolfMetrixCompetitionResults,
  type ExtractedCompetitionResultEntry,
} from "../mapping/competition-results";
import { executeUpdatePlan } from "../orchestration/update-execution";
import {
  createCompetitionResultsRepository,
  type CompetitionResultsRepository,
  type PersistableCompetitionResultRecord,
} from "../persistence/competition-results-repository";
import { createSupabaseCompetitionResultsAdapter } from "../persistence/supabase-competition-results-adapter";
import {
  createCompetitionsForResultsReader,
  createSupabaseCompetitionsForResultsAdapter,
  type CompetitionsForResultsReadResult,
} from "../read-side/competitions-for-results";

export interface ResultsUpdateJobDependencies extends DiscGolfMetrixClientDependencies {
  readCompetitions?: (
    period: UpdatePeriod,
  ) => Promise<CompetitionsForResultsReadResult>;
  resultsRepository?: CompetitionResultsRepository;
  persistResults?: boolean;
}

export interface ResultsUpdateJobResult extends UpdateOperationResult {
  selectedCompetitionsCount?: number;
  fetchedResults?: DiscGolfMetrixResultsResponse[];
  mappedResults?: PersistableCompetitionResultRecord["result"][];
  extractedResults?: ExtractedCompetitionResultEntry[];
}

async function fetchResultsPayloads(
  competitions: CompetitionsForResultsReadResult["competitions"],
  dependencies: DiscGolfMetrixClientDependencies,
): Promise<{
  payloads: DiscGolfMetrixResultsResponse[];
  skippedCount: number;
  issues: UpdateProcessingIssue[];
}> {
  const client = createDiscGolfMetrixClient(dependencies);
  const payloads: DiscGolfMetrixResultsResponse[] = [];
  const issues: UpdateProcessingIssue[] = [];
  let skippedCount = 0;

  for (const competition of competitions) {
    try {
      const payload = await client.fetchResults({
        competitionId: competition.competitionId,
        metrixId: competition.metrixId,
      });
      payloads.push(payload);
    } catch (error) {
      skippedCount += 1;
      issues.push(toDiscGolfMetrixIssue(error, `competition:${competition.competitionId}`));
    }
  }

  return {
    payloads,
    skippedCount,
    issues,
  };
}

function createPersistableCompetitionResultRecords(
  entries: readonly ExtractedCompetitionResultEntry[],
  fetchedResults: readonly DiscGolfMetrixResultsResponse[],
): PersistableCompetitionResultRecord[] {
  const fetchedAtByCompetitionId = new Map<string, string>();

  fetchedResults.forEach((result) => {
    fetchedAtByCompetitionId.set(result.competitionId, result.fetchedAt);
  });

  return entries.map((entry) => ({
    result: entry.result,
    rawPayload: entry.sourceRecord,
    sourceFetchedAt: fetchedAtByCompetitionId.get(entry.competitionId) ?? null,
  }));
}

function resolveResultsJobFinalStatus(
  summary: ReturnType<typeof createEmptyUpdateSummary>,
  successfulFetchCount: number,
): UpdateFinalStatus {
  const successfulPersistenceCount = summary.created + summary.updated;

  if (successfulPersistenceCount > 0) {
    return summary.errors > 0 || summary.skipped > 0
      ? "completed_with_issues"
      : "completed";
  }

  if (successfulFetchCount > 0) {
    return summary.errors > 0 || summary.skipped > 0
      ? "completed_with_issues"
      : "completed";
  }

  if (summary.errors > 0) {
    return "failed";
  }

  return "completed";
}

export async function runResultsUpdateJob(
  period: UpdatePeriod,
  dependencies: ResultsUpdateJobDependencies,
): Promise<ResultsUpdateJobResult> {
  const requestedAt = new Date().toISOString();

  try {
    const supabase = dependencies.readCompetitions
      ? null
      : createWorkerSupabaseAdminClient();
    const readCompetitions =
      dependencies.readCompetitions ??
      createCompetitionsForResultsReader(
        createSupabaseCompetitionsForResultsAdapter(supabase!),
      ).readCompetitions;
    const selectionResult = await readCompetitions(period);
    const fetchedResult = await fetchResultsPayloads(selectionResult.competitions, dependencies);

    if (dependencies.persistResults === false) {
      const summary = createEmptyUpdateSummary();
      summary.found = selectionResult.competitions.length;
      summary.skipped = selectionResult.skippedCount + fetchedResult.skippedCount;
      summary.errors = selectionResult.issues.length + fetchedResult.issues.length;
      const finalStatus = resolveResultsJobFinalStatus(summary, fetchedResult.payloads.length);

      return {
        operation: "results",
        finalStatus,
        source: "runtime",
        message:
          "Worker selected saved competitions for the requested period and fetched raw result payloads from DiscGolfMetrix without requiring manual identifiers.",
        requestedAt,
        finishedAt: new Date().toISOString(),
        summary,
        issues: [...selectionResult.issues, ...fetchedResult.issues],
        period,
        selectedCompetitionsCount: selectionResult.competitions.length,
        fetchedResults: fetchedResult.payloads,
      };
    }

    const mappingResult = mapDiscGolfMetrixCompetitionResults(fetchedResult.payloads);
    const repository =
      dependencies.resultsRepository ??
      createCompetitionResultsRepository(
        createSupabaseCompetitionResultsAdapter(
          supabase ?? createWorkerSupabaseAdminClient(),
        ),
      );
    const persistenceResult = await executeUpdatePlan({
      operation: "results",
      items: createPersistableCompetitionResultRecords(
        mappingResult.extractedResults,
        fetchedResult.payloads,
      ).map((record) => ({
        recordKey: `competition:${record.result.competitionId}:player:${record.result.playerId}`,
        payload: record,
      })),
      processItem: (item) => repository.saveCompetitionResult(item.payload),
      message:
        "Worker fetched result payloads, mapped competition results, and persisted valid records.",
      period,
      requestedAt,
    });
    const summary = {
      ...(persistenceResult.summary ?? createEmptyUpdateSummary()),
      found: mappingResult.results.length,
      skipped:
        (persistenceResult.summary?.skipped ?? 0) +
        selectionResult.skippedCount +
        fetchedResult.skippedCount +
        mappingResult.skippedCount,
      errors:
        (persistenceResult.summary?.errors ?? 0) +
        selectionResult.issues.length +
        fetchedResult.issues.length +
        mappingResult.issues.length,
    };
    const finalStatus = resolveResultsJobFinalStatus(summary, fetchedResult.payloads.length);

    return {
      operation: "results",
      finalStatus,
      source: "runtime",
      message:
        "Worker fetched raw result payloads for saved competitions, mapped valid competition results, and persisted them without creating duplicates.",
      requestedAt,
      finishedAt: new Date().toISOString(),
      summary,
      issues: [
        ...selectionResult.issues,
        ...fetchedResult.issues,
        ...mappingResult.issues,
        ...persistenceResult.issues,
      ],
      period,
      selectedCompetitionsCount: selectionResult.competitions.length,
      fetchedResults: fetchedResult.payloads,
      mappedResults: mappingResult.results,
      extractedResults: mappingResult.extractedResults,
    };
  } catch (error) {
    const issue = toDiscGolfMetrixIssue(error, "results:update");
    const summary = createEmptyUpdateSummary();
    summary.errors = 1;

    return {
      operation: "results",
      finalStatus: "failed",
      source: "runtime",
      message: "Worker could not complete the results fetch pipeline.",
      requestedAt,
      finishedAt: new Date().toISOString(),
      summary,
      issues: [issue],
      period,
    };
  }
}
