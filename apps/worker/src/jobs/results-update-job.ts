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
import {
  createCompetitionResultsRepository,
  type CompetitionResultsRepository,
  type PersistableCompetitionResultRecord,
} from "../persistence/competition-results-repository";
import {
  createCompetitionCommentsRepository,
  createSupabaseCompetitionCommentsAdapter,
  resolveResultsSaveFailureComment,
  type CompetitionCommentsRepository,
} from "../persistence/competition-comments-repository";
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
  competitionCommentsRepository?: CompetitionCommentsRepository;
  persistResults?: boolean;
  overwriteExisting?: boolean;
  reconcileCompetitionComments?: boolean;
  selectionOffset?: number;
  maxCompetitionsPerRun?: number;
}

export interface ResultsUpdateJobResult extends UpdateOperationResult {
  selectedCompetitionsCount?: number;
  selectedCompetitionIds?: string[];
  fetchedResults?: DiscGolfMetrixResultsResponse[];
  mappedResults?: PersistableCompetitionResultRecord["result"][];
  extractedResults?: ExtractedCompetitionResultEntry[];
  nextSelectionOffset?: number;
}

const RESULTS_FETCH_CONCURRENCY = 4;
const MAX_COMPETITIONS_PER_RUN = 50;

function extractCompetitionIdFromRecordKey(
  recordKey: string | undefined,
): string | null {
  if (!recordKey?.startsWith("competition:")) {
    return null;
  }

  const normalizedRecordKey = recordKey.slice("competition:".length);
  const nextSeparatorIndex = normalizedRecordKey.indexOf(":");
  if (nextSeparatorIndex < 0) {
    return normalizedRecordKey.trim() || null;
  }

  const competitionId = normalizedRecordKey.slice(0, nextSeparatorIndex).trim();
  return competitionId.length > 0 ? competitionId : null;
}

function createSaveFailureCommentsByCompetitionId(
  issues: readonly UpdateProcessingIssue[],
): Map<string, string> {
  const commentsByCompetitionId = new Map<string, string>();

  for (const issue of issues) {
    const competitionId = extractCompetitionIdFromRecordKey(issue.recordKey);
    if (!competitionId || commentsByCompetitionId.has(competitionId)) {
      continue;
    }

    commentsByCompetitionId.set(
      competitionId,
      resolveResultsSaveFailureComment(issue.code),
    );
  }

  return commentsByCompetitionId;
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
  const payloads = new Array<DiscGolfMetrixResultsResponse | null>(competitions.length).fill(null);
  const issues: UpdateProcessingIssue[] = [];
  let skippedCount = 0;
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;

      if (currentIndex >= competitions.length) {
        return;
      }

      const competition = competitions[currentIndex]!;

      try {
        const payload = await client.fetchResults({
          competitionId: competition.competitionId,
          metrixId: competition.metrixId,
        });
        payloads[currentIndex] = payload;
      } catch (error) {
        skippedCount += 1;
        issues.push(toDiscGolfMetrixIssue(error, `competition:${competition.competitionId}`));
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(RESULTS_FETCH_CONCURRENCY, competitions.length) },
    () => worker(),
  );

  await Promise.all(workers);

  return {
    payloads: payloads.filter(
      (payload): payload is DiscGolfMetrixResultsResponse => payload !== null,
    ),
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
    const competitionCommentsRepository =
      dependencies.reconcileCompetitionComments === false
        ? null
        : (dependencies.competitionCommentsRepository ??
          (supabase
            ? createCompetitionCommentsRepository(
                createSupabaseCompetitionCommentsAdapter(supabase),
              )
            : null));
    const selectionResult = await readCompetitions(period);
    const selectionOffset = dependencies.selectionOffset ?? 0;
    const maxCompetitionsPerRun =
      dependencies.maxCompetitionsPerRun ?? MAX_COMPETITIONS_PER_RUN;
    const overflowCompetitionsCount = Math.max(
      selectionResult.competitions.length - (selectionOffset + maxCompetitionsPerRun),
      0,
    );
    const boundedCompetitions = selectionResult.competitions.slice(
      selectionOffset,
      selectionOffset + maxCompetitionsPerRun,
    );
    const nextSelectionOffset =
      overflowCompetitionsCount > 0
        ? selectionOffset + boundedCompetitions.length
        : undefined;
    const fetchedResult = await fetchResultsPayloads(boundedCompetitions, dependencies);

    if (dependencies.persistResults === false) {
      const summary = createEmptyUpdateSummary();
      summary.found = boundedCompetitions.length;
      summary.skipped = fetchedResult.skippedCount;
      summary.errors = fetchedResult.issues.length;
      const finalStatus = resolveResultsJobFinalStatus(summary, fetchedResult.payloads.length);

      if (competitionCommentsRepository) {
        await competitionCommentsRepository.reconcileResultsComments({
          competitionIds: boundedCompetitions.map(
            (competition) => competition.competitionId,
          ),
          fetchFailureCompetitionIds: fetchedResult.issues
            .map((issue) => extractCompetitionIdFromRecordKey(issue.recordKey))
            .filter((competitionId): competitionId is string => competitionId !== null),
        });
      }

      return {
        operation: "results",
        finalStatus,
        source: "runtime",
        message:
          "Выбрали сохранённые соревнования за указанный период и загрузили сырые результаты из DiscGolfMetrix без ручного ввода идентификаторов.",
        requestedAt,
        finishedAt: new Date().toISOString(),
        summary,
        issues: [...fetchedResult.issues],
        period,
        selectedCompetitionsCount: boundedCompetitions.length,
        selectedCompetitionIds: boundedCompetitions.map(
          (competition) => competition.competitionId,
        ),
        fetchedResults: fetchedResult.payloads,
        nextSelectionOffset,
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
    const persistenceResult = await repository.saveCompetitionResults(
      createPersistableCompetitionResultRecords(
        mappingResult.extractedResults,
        fetchedResult.payloads,
      ),
      { overwriteExisting: dependencies.overwriteExisting },
    );
    const summary = {
      ...(persistenceResult.summary ?? createEmptyUpdateSummary()),
      found: mappingResult.results.length,
      skipped:
        (persistenceResult.summary?.skipped ?? 0) +
        fetchedResult.skippedCount +
        mappingResult.skippedCount,
      errors:
        (persistenceResult.summary?.errors ?? 0) +
        fetchedResult.issues.length +
        mappingResult.issues.length,
    };
    const finalStatus = resolveResultsJobFinalStatus(summary, fetchedResult.payloads.length);

    if (competitionCommentsRepository) {
      await competitionCommentsRepository.reconcileResultsComments({
        competitionIds: boundedCompetitions.map(
          (competition) => competition.competitionId,
        ),
        fetchFailureCompetitionIds: fetchedResult.issues
          .map((issue) => extractCompetitionIdFromRecordKey(issue.recordKey))
          .filter((competitionId): competitionId is string => competitionId !== null),
        saveFailureCommentsByCompetitionId: createSaveFailureCommentsByCompetitionId([
          ...mappingResult.issues,
          ...persistenceResult.issues,
        ]),
      });
    }

    return {
      operation: "results",
      finalStatus,
      source: "runtime",
      message:
        "Получили сырые результаты по сохранённым соревнованиям, собрали корректные записи результатов и сохранили их без дублей.",
      requestedAt,
      finishedAt: new Date().toISOString(),
      summary,
      issues: [
        ...fetchedResult.issues,
        ...mappingResult.issues,
        ...persistenceResult.issues,
      ],
      period,
      selectedCompetitionsCount: boundedCompetitions.length,
      selectedCompetitionIds: boundedCompetitions.map(
        (competition) => competition.competitionId,
      ),
      fetchedResults: fetchedResult.payloads,
      mappedResults: mappingResult.results,
      extractedResults: mappingResult.extractedResults,
      nextSelectionOffset,
    };
  } catch (error) {
    const issue = toDiscGolfMetrixIssue(error, "results:update");
    const summary = createEmptyUpdateSummary();
    summary.errors = 1;

    return {
      operation: "results",
      finalStatus: "failed",
      source: "runtime",
      message: "Не удалось завершить сценарий загрузки результатов.",
      requestedAt,
      finishedAt: new Date().toISOString(),
      summary,
      issues: [issue],
      period,
    };
  }
}
