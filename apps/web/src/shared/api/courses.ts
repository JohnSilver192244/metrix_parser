import type {
  ApiEnvelope,
  Course,
  CoursesListMeta,
  CoursesListResponse,
} from "@metrix-parser/shared-types";

import { ApiClientError, requestEnvelope, requestJson } from "./http";

export function listCourses(): Promise<
  ApiEnvelope<CoursesListResponse, CoursesListMeta>
> {
  return requestEnvelope<CoursesListResponse, CoursesListMeta>("/courses", {
    method: "GET",
  });
}

export function updateCourse(courseId: string): Promise<Course> {
  return requestJson<Course>(
    `/courses/${encodeURIComponent(courseId)}/update`,
    { method: "POST" },
  );
}

export function resolveCoursesErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.message;
  }

  return "Не удалось загрузить список парков.";
}

export function resolveUpdateCourseErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.message;
  }

  return "Не удалось обновить парк.";
}

export function resolveCoursesTotal(
  courses: Course[],
  meta?: CoursesListMeta,
): number {
  return meta?.count ?? courses.length;
}
