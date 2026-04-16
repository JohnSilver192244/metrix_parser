import type {
  Player,
  UpdateOperationResult,
  UpdatePeriod,
} from "@metrix-parser/shared-types";

import type { DiscGolfMetrixResultsResponse } from "../integration/discgolfmetrix";
import type { ExtractedPlayerEntry } from "../mapping/players";
import type { CompetitionResultsRepository } from "../persistence/competition-results-repository";
import type { PlayersRepository } from "../persistence/players-repository";
import {
  runResultsPipelineUpdateJob,
  type ResultsPipelineUpdateJobDependencies,
  type ResultsPipelineUpdateJobResult,
} from "./results-pipeline-update-job";

export interface PlayersUpdateJobDependencies
  extends Omit<ResultsPipelineUpdateJobDependencies, "playersRepository"> {
  repository?: PlayersRepository;
  resultsRepository?: CompetitionResultsRepository;
}

export interface PlayersUpdateJobResult extends UpdateOperationResult {
  selectedCompetitionsCount?: number;
  fetchedResults?: DiscGolfMetrixResultsResponse[];
  mappedPlayers?: Player[];
  extractedPlayers?: ExtractedPlayerEntry[];
  nextSelectionOffset?: number;
}

function toPlayersUpdateJobResult(
  result: ResultsPipelineUpdateJobResult,
): PlayersUpdateJobResult {
  return {
    ...result,
    operation: "players",
    message:
      "Получили результаты по сохранённым соревнованиям, сохранили игроков и результаты и вернули раздельную диагностику по обеим сущностям.",
  };
}

export async function runPlayersUpdateJob(
  period: UpdatePeriod,
  dependencies: PlayersUpdateJobDependencies,
): Promise<PlayersUpdateJobResult> {
  const pipelineResult = await runResultsPipelineUpdateJob(period, {
    ...dependencies,
    playersRepository: dependencies.repository,
    resultsRepository: dependencies.resultsRepository,
  });

  return toPlayersUpdateJobResult(pipelineResult);
}
