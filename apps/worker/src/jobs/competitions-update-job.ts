import {
  accumulateUpdateSummary,
  createEmptyUpdateSummary,
  type UpdateOperationResult,
  type UpdatePeriod,
  resolveUpdateFinalStatus,
} from "@metrix-parser/shared-types";

import {
  createDiscGolfMetrixClient,
  toDiscGolfMetrixIssue,
  type DiscGolfMetrixClientDependencies,
  type DiscGolfMetrixCompetitionsResponse,
} from "../integration/discgolfmetrix";
import { createWorkerSupabaseAdminClient } from "../lib/supabase-admin";
import { mapDiscGolfMetrixCompetitions } from "../mapping/competitions";
import { executeUpdatePlan } from "../orchestration/update-execution";
import {
  createCompetitionsRepository,
  type CompetitionsRepository,
} from "../persistence/competitions-repository";
import { createSupabaseCompetitionsAdapter } from "../persistence/supabase-competitions-adapter";

export interface CompetitionsUpdateJobDependencies extends DiscGolfMetrixClientDependencies {
  repository?: CompetitionsRepository;
}

export interface CompetitionsUpdateJobResult extends UpdateOperationResult {
  fetchedPayload?: DiscGolfMetrixCompetitionsResponse;
  mappedCompetitionsCount?: number;
}

export async function runCompetitionsUpdateJob(
  period: UpdatePeriod,
  dependencies: CompetitionsUpdateJobDependencies,
): Promise<CompetitionsUpdateJobResult> {
  const requestedAt = new Date().toISOString();
  const client = createDiscGolfMetrixClient(dependencies);

  try {
    const fetchedPayload = await client.fetchCompetitions({ period });
    const repository =
      dependencies.repository ??
      createCompetitionsRepository(
        createSupabaseCompetitionsAdapter(createWorkerSupabaseAdminClient()),
      );
    const mappingResult = mapDiscGolfMetrixCompetitions(fetchedPayload.records);
    const persistenceResult = await executeUpdatePlan({
      operation: "competitions",
      items: mappingResult.competitions.map((competition) => ({
        recordKey: `competition:${competition.competitionId}`,
        payload: {
          competition,
          rawPayload:
            fetchedPayload.records.find((record) => {
              const competitionId = String(
                record.competitionId ?? record.competition_id ?? record.id ?? "",
              );
              const metrixId = String(
                record.metrixId ?? record.metrix_id ?? record.eventId ?? record.event_id ?? "",
              );

              return (
                competitionId === competition.competitionId ||
                (competition.metrixId !== null && metrixId === competition.metrixId)
              );
            }) ?? null,
          sourceFetchedAt: fetchedPayload.fetchedAt,
        },
      })),
      processItem: (item) => repository.saveCompetition(item.payload),
      message:
        "Worker fetched competitions from DiscGolfMetrix, filtered to Russian events, and persisted valid records.",
      period,
      requestedAt,
    });

    let summary = persistenceResult.summary ?? createEmptyUpdateSummary();
    summary = {
      ...summary,
      found: fetchedPayload.records.length,
      skipped: summary.skipped + mappingResult.skippedCount,
      errors: summary.errors + mappingResult.issues.length,
    };
    const issues = [...mappingResult.issues, ...persistenceResult.issues];

    return {
      operation: "competitions",
      finalStatus: resolveUpdateFinalStatus(summary),
      source: "runtime",
      message:
        "Worker fetched competitions from DiscGolfMetrix, filtered to Russian events, and persisted valid records without creating duplicates.",
      requestedAt,
      finishedAt: new Date().toISOString(),
      summary,
      issues,
      period,
      fetchedPayload,
      mappedCompetitionsCount: mappingResult.competitions.length,
    };
  } catch (error) {
    const issue = toDiscGolfMetrixIssue(error);
    const summary = createEmptyUpdateSummary();
    summary.errors = 1;

    return {
      operation: "competitions",
      finalStatus: resolveUpdateFinalStatus(summary),
      source: "runtime",
      message: "Worker could not fetch competitions from DiscGolfMetrix for the requested period.",
      requestedAt,
      finishedAt: new Date().toISOString(),
      summary,
      issues: [issue],
      period,
    };
  }
}
