import {
  createEmptyUpdateSummary,
  resolveUpdateFinalStatus,
  type UpdateOperationResult,
  type UpdatePeriod,
} from "@metrix-parser/shared-types";

import {
  createDiscGolfMetrixClient,
  toDiscGolfMetrixIssue,
  type DiscGolfMetrixClientDependencies,
  type DiscGolfMetrixCompetitionsResponse,
} from "../integration/discgolfmetrix";

export interface CompetitionsUpdateJobDependencies extends DiscGolfMetrixClientDependencies {}

export interface CompetitionsUpdateJobResult extends UpdateOperationResult {
  fetchedPayload?: DiscGolfMetrixCompetitionsResponse;
}

export async function runCompetitionsUpdateJob(
  period: UpdatePeriod,
  dependencies: CompetitionsUpdateJobDependencies,
): Promise<CompetitionsUpdateJobResult> {
  const requestedAt = new Date().toISOString();
  const client = createDiscGolfMetrixClient(dependencies);

  try {
    const fetchedPayload = await client.fetchCompetitions({ period });
    const summary = createEmptyUpdateSummary();
    summary.found = fetchedPayload.records.length;

    return {
      operation: "competitions",
      finalStatus: resolveUpdateFinalStatus(summary),
      source: "runtime",
      message:
        "Worker fetched the raw competitions feed from DiscGolfMetrix and prepared it for the next mapping story.",
      requestedAt,
      finishedAt: new Date().toISOString(),
      summary,
      issues: [],
      period,
      fetchedPayload,
    };
  } catch (error) {
    const issue = toDiscGolfMetrixIssue(error);
    const summary = createEmptyUpdateSummary();
    summary.skipped = 1;
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
