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
  createCompetitionsForResultsReader,
  createSupabaseCompetitionsForResultsAdapter,
  type CompetitionsForResultsReadResult,
} from "../read-side/competitions-for-results";

export interface ResultsUpdateJobDependencies extends DiscGolfMetrixClientDependencies {
  readCompetitions?: (
    period: UpdatePeriod,
  ) => Promise<CompetitionsForResultsReadResult>;
}

export interface ResultsUpdateJobResult extends UpdateOperationResult {
  selectedCompetitionsCount?: number;
  fetchedResults?: DiscGolfMetrixResultsResponse[];
}

function resolveResultsFetchFinalStatus(
  successfulFetchCount: number,
  issuesCount: number,
): UpdateFinalStatus {
  if (successfulFetchCount === 0 && issuesCount > 0) {
    return "failed";
  }

  if (issuesCount > 0) {
    return "completed_with_issues";
  }

  return "completed";
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

    const summary = createEmptyUpdateSummary();
    summary.found = selectionResult.competitions.length;
    summary.skipped = selectionResult.skippedCount + fetchedResult.skippedCount;
    summary.errors = selectionResult.issues.length + fetchedResult.issues.length;
    const finalStatus = resolveResultsFetchFinalStatus(
      fetchedResult.payloads.length,
      summary.errors + summary.skipped,
    );

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
