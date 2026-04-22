import {
  createEmptyUpdateSummary,
  type Player,
  resolveUpdateFinalStatus,
  type CompetitionResult,
  type UpdateDiagnosticsSection,
  type UpdateFinalStatus,
  type UpdateOperationResult,
  type UpdatePeriod,
} from "@metrix-parser/shared-types";

import type { DiscGolfMetrixResultsResponse } from "../integration/discgolfmetrix";
import { createWorkerSupabaseAdminClient } from "../lib/supabase-admin";
import {
  mapDiscGolfMetrixCompetitionResults,
  type ExtractedCompetitionResultEntry,
} from "../mapping/competition-results";
import {
  mapDiscGolfMetrixPlayersFromResults,
  type ExtractedPlayerEntry,
} from "../mapping/players";
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
import {
  createPlayersRepository,
  type PersistablePlayerRecord,
  type PlayersRepository,
} from "../persistence/players-repository";
import { createSupabaseCompetitionResultsAdapter } from "../persistence/supabase-competition-results-adapter";
import { createSupabasePlayersAdapter } from "../persistence/supabase-players-adapter";
import {
  runResultsUpdateJob,
  type ResultsUpdateJobDependencies,
  type ResultsUpdateJobResult,
} from "./results-update-job";

export interface ResultsPipelineUpdateJobDependencies
  extends ResultsUpdateJobDependencies {
  playersRepository?: PlayersRepository;
  resultsRepository?: CompetitionResultsRepository;
  competitionCommentsRepository?: CompetitionCommentsRepository;
  jobId?: string;
}

export interface ResultsPipelineUpdateJobResult extends UpdateOperationResult {
  selectedCompetitionsCount?: number;
  selectedCompetitionIds?: string[];
  fetchedResults?: DiscGolfMetrixResultsResponse[];
  mappedPlayers?: Player[];
  extractedPlayers?: ExtractedPlayerEntry[];
  mappedResults?: CompetitionResult[];
  extractedResults?: ExtractedCompetitionResultEntry[];
  nextSelectionOffset?: number;
}

interface PipelineTimingSnapshot {
  selectedCompetitionsCount: number;
  fetchedResultsCount: number;
  playersCount: number;
  resultsCount: number;
}

function createPipelineTimingSnapshot(
  fetchResult: ResultsUpdateJobResult | null,
  fetchedResults: readonly DiscGolfMetrixResultsResponse[],
  playerMappingResult: { players: Player[] } | null,
  resultMappingResult: { results: CompetitionResult[] } | null,
): PipelineTimingSnapshot {
  return {
    selectedCompetitionsCount: fetchResult?.selectedCompetitionsCount ?? 0,
    fetchedResultsCount: fetchedResults.length,
    playersCount: playerMappingResult?.players.length ?? 0,
    resultsCount: resultMappingResult?.results.length ?? 0,
  };
}

function logResultsPipelineTiming(input: {
  jobId: string;
  operation: string;
  durationMs: number;
  snapshot: PipelineTimingSnapshot;
}): void {
  console.info("[results-pipeline-update-job]", {
    jobId: input.jobId,
    operation: input.operation,
    selectedCompetitionsCount: input.snapshot.selectedCompetitionsCount,
    fetchedResultsLength: input.snapshot.fetchedResultsCount,
    playersCount: input.snapshot.playersCount,
    resultsCount: input.snapshot.resultsCount,
    durationMs: input.durationMs,
  });
}

function createPersistablePlayerRecords(
  mappingResult: {
    players: Player[];
    extractedPlayers: ExtractedPlayerEntry[];
  },
  fetchedResults: readonly DiscGolfMetrixResultsResponse[],
): PersistablePlayerRecord[] {
  const entriesByPlayerId = new Map<string, ExtractedPlayerEntry[]>();
  const fetchedAtByCompetitionId = new Map<string, string>();

  fetchedResults.forEach((result) => {
    fetchedAtByCompetitionId.set(result.competitionId, result.fetchedAt);
  });

  mappingResult.extractedPlayers.forEach((entry) => {
    const existingEntries = entriesByPlayerId.get(entry.player.playerId) ?? [];
    existingEntries.push(entry);
    entriesByPlayerId.set(entry.player.playerId, existingEntries);
  });

  return mappingResult.players.map((player) => {
    const extractedEntry =
      entriesByPlayerId.get(player.playerId)?.find(
        (entry) => entry.player.playerName === player.playerName,
      ) ?? entriesByPlayerId.get(player.playerId)?.[0];

    return {
      player,
      rawPayload: extractedEntry?.sourceRecord ?? null,
      sourceFetchedAt: extractedEntry
        ? (fetchedAtByCompetitionId.get(extractedEntry.competitionId) ?? null)
        : null,
    };
  });
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

function createDiagnosticsSection(
  baseSummary: ReturnType<typeof createEmptyUpdateSummary>,
  issues: UpdateDiagnosticsSection["issues"],
): UpdateDiagnosticsSection {
  return {
    summary: {
      ...baseSummary,
      errors: issues.length,
    },
    issues,
  };
}

function resolveResultsPipelineFinalStatus(
  summary: ReturnType<typeof createEmptyUpdateSummary>,
  fetchResult: ResultsUpdateJobResult,
): UpdateFinalStatus {
  const successfulRecords = summary.created + summary.updated;
  const successfulFetchCount = fetchResult.fetchedResults?.length ?? 0;

  if (successfulRecords > 0) {
    return resolveUpdateFinalStatus(summary);
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
  issues: readonly { code: string; recordKey?: string }[],
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

export async function runResultsPipelineUpdateJob(
  period: UpdatePeriod,
  dependencies: ResultsPipelineUpdateJobDependencies,
): Promise<ResultsPipelineUpdateJobResult> {
  const jobId = dependencies.jobId ?? "unknown";
  const startedAtMs = Date.now();
  let stepStartedAtMs = startedAtMs;
  logResultsPipelineTiming({
    jobId,
    operation: "job.enter",
    durationMs: 0,
    snapshot: createPipelineTimingSnapshot(null, [], null, null),
  });

  const fetchResult = await runResultsUpdateJob(period, {
    ...dependencies,
    persistResults: false,
    reconcileCompetitionComments: false,
  });
  const fetchedResults = fetchResult.fetchedResults ?? [];
  const requestedAt = fetchResult.requestedAt;
  const afterFetchAtMs = Date.now();
  logResultsPipelineTiming({
    jobId,
    operation: "after.runResultsUpdateJob.persistResults.false",
    durationMs: afterFetchAtMs - stepStartedAtMs,
    snapshot: createPipelineTimingSnapshot(fetchResult, fetchedResults, null, null),
  });
  stepStartedAtMs = afterFetchAtMs;

  const playerMappingResult = mapDiscGolfMetrixPlayersFromResults(fetchedResults);
  const afterMapPlayersAtMs = Date.now();
  logResultsPipelineTiming({
    jobId,
    operation: "after.mapDiscGolfMetrixPlayersFromResults",
    durationMs: afterMapPlayersAtMs - stepStartedAtMs,
    snapshot: createPipelineTimingSnapshot(
      fetchResult,
      fetchedResults,
      playerMappingResult,
      null,
    ),
  });
  stepStartedAtMs = afterMapPlayersAtMs;

  const resultMappingResult = mapDiscGolfMetrixCompetitionResults(fetchedResults);
  const afterMapResultsAtMs = Date.now();
  logResultsPipelineTiming({
    jobId,
    operation: "after.mapDiscGolfMetrixCompetitionResults",
    durationMs: afterMapResultsAtMs - stepStartedAtMs,
    snapshot: createPipelineTimingSnapshot(
      fetchResult,
      fetchedResults,
      playerMappingResult,
      resultMappingResult,
    ),
  });
  stepStartedAtMs = afterMapResultsAtMs;

  const supabase =
    dependencies.playersRepository || dependencies.resultsRepository
      ? null
      : createWorkerSupabaseAdminClient();
  const playersRepository =
    dependencies.playersRepository ??
    createPlayersRepository(
      createSupabasePlayersAdapter(supabase ?? createWorkerSupabaseAdminClient()),
    );
  const resultsRepository =
    dependencies.resultsRepository ??
    createCompetitionResultsRepository(
      createSupabaseCompetitionResultsAdapter(
        supabase ?? createWorkerSupabaseAdminClient(),
      ),
    );
  const competitionCommentsRepository =
    dependencies.competitionCommentsRepository ??
    (supabase
      ? createCompetitionCommentsRepository(
          createSupabaseCompetitionCommentsAdapter(supabase),
        )
      : null);

  const playerPersistenceResult = await playersRepository.savePlayers(
    createPersistablePlayerRecords(playerMappingResult, fetchedResults),
    {
      overwriteExisting: dependencies.overwriteExisting,
      jobId,
    },
  );
  const afterSavePlayersAtMs = Date.now();
  logResultsPipelineTiming({
    jobId,
    operation: "after.playersRepository.savePlayers",
    durationMs: afterSavePlayersAtMs - stepStartedAtMs,
    snapshot: createPipelineTimingSnapshot(
      fetchResult,
      fetchedResults,
      playerMappingResult,
      resultMappingResult,
    ),
  });
  stepStartedAtMs = afterSavePlayersAtMs;

  const resultPersistenceResult = await resultsRepository.saveCompetitionResults(
    createPersistableCompetitionResultRecords(
      resultMappingResult.extractedResults,
      fetchedResults,
    ),
    {
      overwriteExisting: dependencies.overwriteExisting,
      jobId,
    },
  );
  const afterSaveResultsAtMs = Date.now();
  logResultsPipelineTiming({
    jobId,
    operation: "after.resultsRepository.saveCompetitionResults",
    durationMs: afterSaveResultsAtMs - stepStartedAtMs,
    snapshot: createPipelineTimingSnapshot(
      fetchResult,
      fetchedResults,
      playerMappingResult,
      resultMappingResult,
    ),
  });
  stepStartedAtMs = afterSaveResultsAtMs;

  const transportSummary = {
    ...(fetchResult.summary ?? createEmptyUpdateSummary()),
  };
  const playerSummary = {
    ...(playerPersistenceResult.summary ?? createEmptyUpdateSummary()),
    found: playerMappingResult.players.length,
    skipped:
      (playerPersistenceResult.summary?.skipped ?? 0) +
      playerMappingResult.skippedCount,
    errors:
      (playerPersistenceResult.summary?.errors ?? 0) +
      playerMappingResult.issues.length,
  };
  const resultSummary = {
    ...(resultPersistenceResult.summary ?? createEmptyUpdateSummary()),
    found: resultMappingResult.results.length,
    skipped:
      (resultPersistenceResult.summary?.skipped ?? 0) +
      resultMappingResult.skippedCount,
    errors:
      (resultPersistenceResult.summary?.errors ?? 0) +
      resultMappingResult.issues.length,
  };

  const summary = {
    found: playerSummary.found + resultSummary.found,
    created: playerSummary.created + resultSummary.created,
    updated: playerSummary.updated + resultSummary.updated,
    skipped: transportSummary.skipped + playerSummary.skipped + resultSummary.skipped,
    errors: transportSummary.errors + playerSummary.errors + resultSummary.errors,
  };

  const beforeReconcileAtMs = Date.now();
  logResultsPipelineTiming({
    jobId,
    operation: "before.reconcileResultsComments",
    durationMs: beforeReconcileAtMs - stepStartedAtMs,
    snapshot: createPipelineTimingSnapshot(
      fetchResult,
      fetchedResults,
      playerMappingResult,
      resultMappingResult,
    ),
  });
  stepStartedAtMs = beforeReconcileAtMs;

  if (competitionCommentsRepository) {
    await competitionCommentsRepository.reconcileResultsComments({
      competitionIds: fetchResult.selectedCompetitionIds ?? [],
      fetchFailureCompetitionIds: fetchResult.issues
        .map((issue) => extractCompetitionIdFromRecordKey(issue.recordKey))
        .filter((competitionId): competitionId is string => competitionId !== null),
      saveFailureCommentsByCompetitionId: createSaveFailureCommentsByCompetitionId([
        ...resultMappingResult.issues,
        ...resultPersistenceResult.issues,
      ]),
      jobId,
    });
  }
  const afterReconcileAtMs = Date.now();
  logResultsPipelineTiming({
    jobId,
    operation: "after.reconcileResultsComments",
    durationMs: afterReconcileAtMs - stepStartedAtMs,
    snapshot: createPipelineTimingSnapshot(
      fetchResult,
      fetchedResults,
      playerMappingResult,
      resultMappingResult,
    ),
  });
  stepStartedAtMs = afterReconcileAtMs;

  const beforeReturnAtMs = Date.now();
  logResultsPipelineTiming({
    jobId,
    operation: "before.return",
    durationMs: beforeReturnAtMs - stepStartedAtMs,
    snapshot: createPipelineTimingSnapshot(
      fetchResult,
      fetchedResults,
      playerMappingResult,
      resultMappingResult,
    ),
  });

  return {
    operation: "results",
    finalStatus: resolveResultsPipelineFinalStatus(summary, fetchResult),
    source: fetchResult.source,
    message:
      "Получили результаты по сохранённым соревнованиям, устойчиво сохранили корректных игроков и результаты и вернули структурированную диагностику по пропущенным записям.",
    requestedAt,
    finishedAt: new Date().toISOString(),
    summary,
    issues: [
      ...fetchResult.issues,
      ...playerMappingResult.issues,
      ...playerPersistenceResult.issues,
      ...resultMappingResult.issues,
      ...resultPersistenceResult.issues,
    ],
    diagnostics: {
      transport: createDiagnosticsSection(transportSummary, fetchResult.issues),
      players: createDiagnosticsSection(
        playerSummary,
        [...playerMappingResult.issues, ...playerPersistenceResult.issues],
      ),
      results: createDiagnosticsSection(
        resultSummary,
        [...resultMappingResult.issues, ...resultPersistenceResult.issues],
      ),
    },
    period,
    selectedCompetitionsCount: fetchResult.selectedCompetitionsCount,
    selectedCompetitionIds: fetchResult.selectedCompetitionIds,
    fetchedResults,
    mappedPlayers: playerMappingResult.players,
    extractedPlayers: playerMappingResult.extractedPlayers,
    mappedResults: resultMappingResult.results,
    extractedResults: resultMappingResult.extractedResults,
    nextSelectionOffset: fetchResult.nextSelectionOffset,
  };
}
