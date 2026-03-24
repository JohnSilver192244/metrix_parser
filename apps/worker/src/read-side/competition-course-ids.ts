import type { SupabaseClient } from "@supabase/supabase-js";

import { createUpdateIssue, type UpdateProcessingIssue } from "@metrix-parser/shared-types";

import { readOptionalStringField } from "../parsing/competition-record";

const APP_PUBLIC_SCHEMA = "app_public";

export interface CompetitionSourceRow {
  competition_id: string;
  course_id: string | null;
  raw_payload: Record<string, unknown> | null;
}

export interface CompetitionCourseIdsAdapter {
  listCompetitionSources(): Promise<CompetitionSourceRow[]>;
}

export interface CompetitionCourseIdsReadResult {
  courseIds: string[];
  skippedCount: number;
  issues: UpdateProcessingIssue[];
}

function createCompetitionIssue(
  competitionId: string,
  message: string,
): UpdateProcessingIssue {
  return createUpdateIssue({
    code: "competition_missing_course_reference",
    message,
    recoverable: true,
    stage: "validation",
    recordKey: `competition:${competitionId}`,
  });
}

function readNestedCourseId(payload: Record<string, unknown>): string | undefined {
  const course = payload.course;

  if (typeof course !== "object" || course === null || Array.isArray(course)) {
    return undefined;
  }

  return readOptionalStringField(course as Record<string, unknown>, [
    "ID",
    "id",
    "courseId",
    "course_id",
  ]);
}

export function extractCourseIdFromCompetitionPayload(
  payload: Record<string, unknown> | null,
): string | undefined {
  if (!payload) {
    return undefined;
  }

  return (
    readOptionalStringField(payload, [
      "CourceID",
      "CourseID",
      "courseId",
      "course_id",
      "courseid",
      "layoutId",
      "layout_id",
    ]) ?? readNestedCourseId(payload)
  );
}

export function createCompetitionCourseIdsReader(
  adapter: CompetitionCourseIdsAdapter,
) {
  return {
    async readCourseIds(): Promise<CompetitionCourseIdsReadResult> {
      const rows = await adapter.listCompetitionSources();
      const uniqueCourseIds = new Set<string>();
      const issues: UpdateProcessingIssue[] = [];
      let skippedCount = 0;

      for (const row of rows) {
        const courseId =
          row.course_id?.trim() ||
          extractCourseIdFromCompetitionPayload(row.raw_payload);

        if (!courseId) {
          skippedCount += 1;
          issues.push(
            createCompetitionIssue(
              row.competition_id,
              "Competition source payload does not contain a course identifier.",
            ),
          );
          continue;
        }

        uniqueCourseIds.add(courseId);
      }

      return {
        courseIds: [...uniqueCourseIds],
        skippedCount,
        issues,
      };
    },
  };
}

export function createSupabaseCompetitionCourseIdsAdapter(
  supabase: SupabaseClient,
): CompetitionCourseIdsAdapter {
  return {
    async listCompetitionSources() {
      const { data, error } = await supabase
        .schema(APP_PUBLIC_SCHEMA)
        .from("competitions")
        .select("competition_id, course_id, raw_payload")
        .order("competition_id", { ascending: true });

      if (error) {
        throw new Error(`Failed to load saved competitions for course discovery: ${error.message}`);
      }

      return (data ?? []) as CompetitionSourceRow[];
    },
  };
}
