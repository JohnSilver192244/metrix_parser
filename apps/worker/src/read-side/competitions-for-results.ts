import type { SupabaseClient } from "@supabase/supabase-js";

import { createUpdateIssue, type UpdatePeriod, type UpdateProcessingIssue } from "@metrix-parser/shared-types";

export interface SavedCompetitionReference {
  competitionId: string;
  metrixId: string | null;
  competitionDate: string;
}

export interface SavedCompetitionRow {
  competition_id: string | null;
  metrix_id: string | null;
  competition_date: string;
}

export interface CompetitionsForResultsAdapter {
  listCompetitionsForPeriod(period: UpdatePeriod): Promise<SavedCompetitionRow[]>;
}

export interface CompetitionsForResultsReadResult {
  competitions: SavedCompetitionReference[];
  skippedCount: number;
  issues: UpdateProcessingIssue[];
}

function createCompetitionIssue(
  competitionDate: string,
  message: string,
): UpdateProcessingIssue {
  return createUpdateIssue({
    code: "competition_missing_identity",
    message,
    recoverable: true,
    stage: "validation",
    recordKey: `competition-date:${competitionDate}`,
  });
}

export function createCompetitionsForResultsReader(
  adapter: CompetitionsForResultsAdapter,
) {
  return {
    async readCompetitions(period: UpdatePeriod): Promise<CompetitionsForResultsReadResult> {
      const rows = await adapter.listCompetitionsForPeriod(period);
      const competitions: SavedCompetitionReference[] = [];
      const issues: UpdateProcessingIssue[] = [];
      let skippedCount = 0;

      for (const row of rows) {
        const competitionId = row.competition_id?.trim() || "";
        const metrixId = row.metrix_id?.trim() || null;

        if (!competitionId) {
          skippedCount += 1;
          issues.push(
            createCompetitionIssue(
              row.competition_date,
              "Saved competition row is missing competition_id required for results fetch.",
            ),
          );
          continue;
        }

        competitions.push({
          competitionId,
          metrixId,
          competitionDate: row.competition_date,
        });
      }

      return {
        competitions,
        skippedCount,
        issues,
      };
    },
  };
}

export function createSupabaseCompetitionsForResultsAdapter(
  supabase: SupabaseClient,
): CompetitionsForResultsAdapter {
  return {
    async listCompetitionsForPeriod(period) {
      const { data, error } = await supabase
        .from("competitions")
        .select("competition_id, metrix_id, competition_date")
        .gte("competition_date", period.dateFrom)
        .lte("competition_date", period.dateTo)
        .order("competition_date", { ascending: true })
        .order("competition_id", { ascending: true });

      if (error) {
        throw new Error(`Failed to load competitions for results update: ${error.message}`);
      }

      return (data ?? []) as SavedCompetitionRow[];
    },
  };
}
