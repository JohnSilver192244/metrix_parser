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
import { mapWithConcurrency } from "../lib/bounded-concurrency";
import { createWorkerSupabaseAdminClient } from "../lib/supabase-admin";
import { mapDiscGolfMetrixCourseRecord } from "../mapping/courses";
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
  overwriteExisting?: boolean;
  courseIdOffset?: number;
  maxCourseIdsPerRun?: number;
}

export interface CoursesUpdateJobResult extends UpdateOperationResult {
  discoveredCourseIds?: string[];
  fetchedCoursesCount?: number;
  nextCourseIdOffset?: number;
}

const COURSES_FETCH_CONCURRENCY = 6;
const MAX_COURSE_IDS_PER_RUN = 100;

async function fetchCoursePayloads(
  courseIds: readonly string[],
  dependencies: DiscGolfMetrixClientDependencies,
): Promise<{
  responses: DiscGolfMetrixCourseResponse[];
  skippedCount: number;
  issues: ReturnType<typeof toDiscGolfMetrixIssue>[];
}> {
  const client = createDiscGolfMetrixClient(dependencies);
  const responses = new Array<DiscGolfMetrixCourseResponse | null>(courseIds.length).fill(null);
  const issues: ReturnType<typeof toDiscGolfMetrixIssue>[] = [];
  let skippedCount = 0;

  await mapWithConcurrency(
    courseIds,
    COURSES_FETCH_CONCURRENCY,
    async (courseId, index) => {
      try {
        responses[index] = await client.fetchCourse({ courseId });
      } catch (error) {
        skippedCount += 1;
        issues.push(toDiscGolfMetrixIssue(error, `course:${courseId}`));
      }
    },
  );

  return {
    responses: responses.filter(
      (response): response is DiscGolfMetrixCourseResponse => response !== null,
    ),
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
    const courseIdOffset = dependencies.courseIdOffset ?? 0;
    const maxCourseIdsPerRun = dependencies.maxCourseIdsPerRun ?? MAX_COURSE_IDS_PER_RUN;
    const overflowCourseIdsCount = Math.max(
      discoveryResult.courseIds.length - (courseIdOffset + maxCourseIdsPerRun),
      0,
    );
    const boundedCourseIds = discoveryResult.courseIds.slice(
      courseIdOffset,
      courseIdOffset + maxCourseIdsPerRun,
    );
    const nextCourseIdOffset =
      overflowCourseIdsCount > 0
        ? courseIdOffset + boundedCourseIds.length
        : undefined;
    const fetchedResult = await fetchCoursePayloads(boundedCourseIds, dependencies);
    const mappingIssues: UpdateProcessingIssue[] = [];
    const mappedCourses: Parameters<CoursesRepository["saveCourses"]>[0] = [];

    for (const response of fetchedResult.responses) {
      const mapped = mapDiscGolfMetrixCourseRecord(response.record, response.courseId);

      if (!mapped.ok) {
        mappingIssues.push(mapped.issue);
        continue;
      }

      mappedCourses.push({
        course: mapped.course,
        rawPayload: response.rawPayload,
        sourceFetchedAt: response.fetchedAt,
      });
    }

    const persistenceResult = await repository.saveCourses(mappedCourses, {
      overwriteExisting: dependencies.overwriteExisting,
    });

    const summary = {
      ...(persistenceResult.summary ?? createEmptyUpdateSummary()),
      found: boundedCourseIds.length,
      skipped:
        (persistenceResult.summary?.skipped ?? 0) +
        fetchedResult.skippedCount +
        mappingIssues.length,
      errors:
        (persistenceResult.summary?.errors ?? 0) +
        fetchedResult.issues.length +
        mappingIssues.length,
    };
    const issues = [
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
      discoveredCourseIds: boundedCourseIds,
      fetchedCoursesCount: fetchedResult.responses.length,
      nextCourseIdOffset,
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
