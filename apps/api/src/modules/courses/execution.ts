import type { Course, CourseDbRecord } from "@metrix-parser/shared-types";

import { loadWorkerExecutionEnv } from "../../../../worker/src/config/env";
import { executeSingleCourseUpdate } from "../../../../worker/src/orchestration/courses-single-update";
import { createSupabaseCoursesAdapter } from "../../../../worker/src/persistence/supabase-courses-adapter";
import { createApiSupabaseAdminClient } from "../../lib/supabase-admin";

function toCourse(record: CourseDbRecord): Course {
  return {
    courseId: record.course_id,
    name: record.name,
    fullname: record.fullname,
    type: record.type,
    countryCode: record.country_code,
    area: record.area,
    ratingValue1: record.rating_value1,
    ratingResult1: record.rating_result1,
    ratingValue2: record.rating_value2,
    ratingResult2: record.rating_result2,
    coursePar: record.course_par,
    basketsCount: record.baskets_count,
  };
}

export async function executeRuntimeSingleCourseUpdate(
  courseId: string,
): Promise<Course> {
  const result = await executeSingleCourseUpdate(courseId, loadWorkerExecutionEnv());

  if (result.finalStatus === "failed") {
    const firstIssue = result.issues[0];
    throw new Error(firstIssue?.message ?? "Не удалось обновить парк.");
  }

  const supabase = createApiSupabaseAdminClient();
  const adapter = createSupabaseCoursesAdapter(supabase);
  const record = await adapter.findByCourseId(courseId);

  if (!record) {
    throw new Error(`Course ${courseId} not found after update`);
  }

  return toCourse(record);
}
