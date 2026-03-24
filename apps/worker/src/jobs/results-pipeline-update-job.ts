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
}

export interface ResultsPipelineUpdateJobResult extends UpdateOperationResult {
  selectedCompetitionsCount?: number;
  fetchedResults?: DiscGolfMetrixResultsResponse[];
  mappedPlayers?: Player[];
  extractedPlayers?: ExtractedPlayerEntry[];
  mappedResults?: CompetitionResult[];
  extractedResults?: ExtractedCompetitionResultEntry[];
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

export async function runResultsPipelineUpdateJob(
  period: UpdatePeriod,
  dependencies: ResultsPipelineUpdateJobDependencies,
): Promise<ResultsPipelineUpdateJobResult> {
  const fetchResult = await runResultsUpdateJob(period, {
    ...dependencies,
    persistResults: false,
  });
  const fetchedResults = fetchResult.fetchedResults ?? [];
  const requestedAt = fetchResult.requestedAt;

  const playerMappingResult = mapDiscGolfMetrixPlayersFromResults(fetchedResults);
  const resultMappingResult = mapDiscGolfMetrixCompetitionResults(fetchedResults);

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

  const playerPersistenceResult = await playersRepository.savePlayers(
    createPersistablePlayerRecords(playerMappingResult, fetchedResults),
  );
  const resultPersistenceResult = await resultsRepository.saveCompetitionResults(
    createPersistableCompetitionResultRecords(
      resultMappingResult.extractedResults,
      fetchedResults,
    ),
  );

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
    fetchedResults,
    mappedPlayers: playerMappingResult.players,
    extractedPlayers: playerMappingResult.extractedPlayers,
    mappedResults: resultMappingResult.results,
    extractedResults: resultMappingResult.extractedResults,
  };
}
