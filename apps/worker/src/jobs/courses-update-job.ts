import {
  createEmptyUpdateSummary,
  resolveUpdateFinalStatus,
  type UpdateOperationResult,
  type UpdateProcessingIssue,
} from "@metrix-parser/shared-types";

import {
  createDiscGolfMetrixClient,
  toDiscGolfMetrixIssue,
  type DiscGolfMetrixClientDependencies,
  type DiscGolfMetrixCourseResponse,
} from "../integration/discgolfmetrix";
import { createWorkerSupabaseAdminClient } from "../lib/supabase-admin";
import { mapDiscGolfMetrixCourseRecord } from "../mapping/courses";
import { executeUpdatePlan } from "../orchestration/update-execution";
import {
  createCoursesRepository,
  type CoursesRepository,
} from "../persistence/courses-repository";
import { createSupabaseCoursesAdapter } from "../persistence/supabase-courses-adapter";
import {
  createCompetitionCourseIdsReader,
  createSupabaseCompetitionCourseIdsAdapter,
  type CompetitionCourseIdsReadResult,
} from "../read-side/competition-course-ids";

export interface CoursesUpdateJobDependencies extends DiscGolfMetrixClientDependencies {
  readCourseIds?: () => Promise<CompetitionCourseIdsReadResult>;
  repository?: CoursesRepository;
}

export interface CoursesUpdateJobResult extends UpdateOperationResult {
  discoveredCourseIds?: string[];
  fetchedCoursesCount?: number;
}

async function fetchCoursePayloads(
  courseIds: readonly string[],
  dependencies: DiscGolfMetrixClientDependencies,
): Promise<{
  responses: DiscGolfMetrixCourseResponse[];
  skippedCount: number;
  issues: ReturnType<typeof toDiscGolfMetrixIssue>[];
}> {
  const client = createDiscGolfMetrixClient(dependencies);
  const responses: DiscGolfMetrixCourseResponse[] = [];
  const issues: ReturnType<typeof toDiscGolfMetrixIssue>[] = [];
  let skippedCount = 0;

  for (const courseId of courseIds) {
    try {
      const response = await client.fetchCourse({ courseId });
      responses.push(response);
    } catch (error) {
      skippedCount += 1;
      issues.push(toDiscGolfMetrixIssue(error, `course:${courseId}`));
    }
  }

  return {
    responses,
    skippedCount,
    issues,
  };
}

export async function runCoursesUpdateJob(
  dependencies: CoursesUpdateJobDependencies,
): Promise<CoursesUpdateJobResult> {
  const requestedAt = new Date().toISOString();

  try {
    const supabase =
      dependencies.readCourseIds && dependencies.repository
        ? null
        : createWorkerSupabaseAdminClient();
    const readCourseIds =
      dependencies.readCourseIds ??
      createCompetitionCourseIdsReader(
        createSupabaseCompetitionCourseIdsAdapter(supabase!),
      ).readCourseIds;
    const repository =
      dependencies.repository ??
      createCoursesRepository(createSupabaseCoursesAdapter(supabase!));
    const discoveryResult = await readCourseIds();

    const fetchedResult = await fetchCoursePayloads(discoveryResult.courseIds, dependencies);
    const mappingIssues: UpdateProcessingIssue[] = [];
    const mappedCourses: Array<{
      recordKey: string;
      payload: {
        course: Parameters<CoursesRepository["saveCourse"]>[0]["course"];
        rawPayload: Record<string, unknown> | null;
        sourceFetchedAt: string | null;
      };
    }> = [];

    for (const response of fetchedResult.responses) {
      const mapped = mapDiscGolfMetrixCourseRecord(response.record, response.courseId);

      if (!mapped.ok) {
        mappingIssues.push(mapped.issue);
        continue;
      }

      mappedCourses.push({
        recordKey: `course:${mapped.course.courseId}`,
        payload: {
          course: mapped.course,
          rawPayload: response.rawPayload,
          sourceFetchedAt: response.fetchedAt,
        },
      });
    }

    const persistenceResult = await executeUpdatePlan({
      operation: "courses",
      items: mappedCourses,
      processItem: (item) => repository.saveCourse(item.payload),
      message:
        "Определили идентификаторы парков по сохранённым соревнованиям, загрузили данные парков из DiscGolfMetrix и сохранили нормализованные записи.",
      requestedAt,
    });

    const summary = {
      ...(persistenceResult.summary ?? createEmptyUpdateSummary()),
      found: discoveryResult.courseIds.length,
      skipped:
        (persistenceResult.summary?.skipped ?? 0) +
        discoveryResult.skippedCount +
        fetchedResult.skippedCount +
        mappingIssues.length,
      errors:
        (persistenceResult.summary?.errors ?? 0) +
        discoveryResult.issues.length +
        fetchedResult.issues.length +
        mappingIssues.length,
    };
    const issues = [
      ...discoveryResult.issues,
      ...fetchedResult.issues,
      ...mappingIssues,
      ...persistenceResult.issues,
    ];

    return {
      operation: "courses",
      finalStatus: resolveUpdateFinalStatus(summary),
      source: "runtime",
      message:
        "Определили идентификаторы парков по сохранённым соревнованиям, отдельно загрузили каждый парк и сохранили корректные курсы с рассчитанным course_par.",
      requestedAt,
      finishedAt: new Date().toISOString(),
      summary,
      issues,
      discoveredCourseIds: discoveryResult.courseIds,
      fetchedCoursesCount: fetchedResult.responses.length,
    };
  } catch (error) {
    const issue = toDiscGolfMetrixIssue(error, "courses:update");
    const summary = createEmptyUpdateSummary();
    summary.errors = 1;

    return {
      operation: "courses",
      finalStatus: resolveUpdateFinalStatus(summary),
      source: "runtime",
      message: "Не удалось завершить сценарий обновления парков.",
      requestedAt,
      finishedAt: new Date().toISOString(),
      summary,
      issues: [issue],
    };
  }
}
