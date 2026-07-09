import type { Course, CourseDbRecord } from "@metrix-parser/shared-types";

import { HttpError } from "../../lib/http-errors";
import { sendSuccess } from "../../lib/http";
import { resolveListPagination } from "../../lib/pagination";
import type { RouteDefinition } from "../../lib/router";
import { createApiSupabaseAdminClient } from "../../lib/supabase-admin";
import { invalidateApiReadCacheAll } from "../../lib/api-read-cache";
import {
  readSessionToken,
  requireAuthenticatedUser,
  type AuthGuardDependencies,
} from "../auth/runtime";
import { executeRuntimeSingleCourseUpdate } from "./execution";

const APP_PUBLIC_SCHEMA = "app_public";
const COURSES_SELECT_COLUMNS = [
  "course_id",
  "name",
  "fullname",
  "type",
  "country_code",
  "area",
  "rating_value1",
  "rating_result1",
  "rating_value2",
  "rating_result2",
  "course_par",
  "baskets_count",
].join(", ");

interface CourseReadAdapter {
  listCourses(): Promise<CourseDbRecord[]>;
}

export interface CoursesRouteDependencies {
  listCourses?: () => Promise<Course[]>;
  updateCourse?: (courseId: string) => Promise<Course>;
}

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

function createSupabaseCourseReadAdapter(): CourseReadAdapter {
  const supabase = createApiSupabaseAdminClient();

  return {
    async listCourses() {
      const { data, error } = await supabase
        .schema(APP_PUBLIC_SCHEMA)
        .from("courses")
        .select(COURSES_SELECT_COLUMNS)
        .order("name", { ascending: true });

      if (error) {
        throw new Error(`Failed to load courses list: ${error.message}`);
      }

      return (data ?? []) as unknown as CourseDbRecord[];
    },
  };
}

async function listCoursesFromRuntime(): Promise<Course[]> {
  const adapter = createSupabaseCourseReadAdapter();
  const records = await adapter.listCourses();

  return records.map(toCourse);
}

export function getCoursesRoutes(
  dependencies: CoursesRouteDependencies = {},
  authDependencies: AuthGuardDependencies = {},
): RouteDefinition[] {
  return [
    {
      method: "GET",
      path: "/courses",
      handler: async ({ res, url }) => {
        const pagination = resolveListPagination(url);
        const allCourses = await (dependencies.listCourses ?? listCoursesFromRuntime)();
        const courses = allCourses.slice(
          pagination.offset,
          pagination.offset + pagination.limit,
        );

        sendSuccess(res, courses, {
          count: courses.length,
          limit: pagination.limit,
          offset: pagination.offset,
        });
      },
    },
    {
      method: "POST",
      path: "/courses/:courseId/update",
      handler: async ({ req, res, params }) => {
        const user = await requireAuthenticatedUser(
          readSessionToken(req),
          authDependencies,
        );
        const courseId = params.courseId?.trim();
        if (!courseId) {
          throw new HttpError(400, "invalid_course_id", "courseId is required");
        }

        const updateCourse = dependencies.updateCourse ?? executeRuntimeSingleCourseUpdate;
        const course = await updateCourse(courseId);

        invalidateApiReadCacheAll();
        sendSuccess(res, course);
      },
    },
  ];
}
