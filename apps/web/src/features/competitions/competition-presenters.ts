import type { Competition, Course } from "@metrix-parser/shared-types";

import { decodeHtmlEntities } from "../../shared/text";

export const COMPETITION_COURSE_FALLBACK = "Обновите парки";
export const COMPETITION_RECORD_TYPE_LABELS: Readonly<Record<string, string>> = {
  "1": "Round",
  "2": "Single round event",
  "3": "Pool",
  "4": "Event",
  "5": "Tour",
};

const VISIBLE_COMPETITION_RECORD_TYPES = new Set(["2", "4"]);

export function formatCompetitionDate(value: string): string {
  const [year, month, day] = value.split("-");

  return `${day}.${month}.${year}`;
}

export function formatCompetitionRecordType(value: string | null): string {
  if (value === null) {
    return "Не указан";
  }

  return COMPETITION_RECORD_TYPE_LABELS[value] ?? value;
}

export function isVisibleCompetitionRecordType(value: string | null): boolean {
  return value !== null && VISIBLE_COMPETITION_RECORD_TYPES.has(value);
}

export function filterVisibleCompetitions(
  competitions: readonly Competition[],
): Competition[] {
  return competitions.filter((competition) => {
    return isVisibleCompetitionRecordType(competition.recordType);
  });
}

export function createCourseNamesById(
  courses: readonly Course[],
): Readonly<Record<string, string>> {
  return Object.fromEntries(
    courses.map((course) => [course.courseId, decodeHtmlEntities(course.name)]),
  );
}

export function resolveCompetitionCourseName(
  competition: Competition,
  courseNamesById: Readonly<Record<string, string>>,
): string {
  const savedCourseName = decodeHtmlEntities(competition.courseName?.trim());
  if (savedCourseName) {
    return savedCourseName;
  }

  if (!competition.courseId) {
    return COMPETITION_COURSE_FALLBACK;
  }

  return decodeHtmlEntities(courseNamesById[competition.courseId]) || COMPETITION_COURSE_FALLBACK;
}
