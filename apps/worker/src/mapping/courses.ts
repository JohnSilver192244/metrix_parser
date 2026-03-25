import {
  createUpdateIssue,
  type Course,
  type UpdateProcessingIssue,
} from "@metrix-parser/shared-types";

import type { DiscGolfMetrixRawCourseRecord } from "../integration/discgolfmetrix";
import {
  readOptionalNumberField,
  readOptionalStringField,
} from "../parsing/competition-record";

const HOLE_COLLECTION_KEYS = new Set([
  "baskets",
  "holes",
  "segments",
  "tracks",
  "fairways",
  "layouts",
  "lanes",
]);

function createCourseIssue(
  recordKey: string,
  missingField: string,
): UpdateProcessingIssue {
  return createUpdateIssue({
    code: "invalid_course_record",
    message: `В записи парка отсутствует обязательное поле: ${missingField}.`,
    recoverable: true,
    stage: "validation",
    recordKey,
  });
}

function toObject(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function unwrapCourseRecord(
  record: DiscGolfMetrixRawCourseRecord,
): Record<string, unknown> {
  const nestedCourse = toObject(record.course);

  return nestedCourse ?? record;
}

function buildRecordKey(record: Record<string, unknown>, fallbackId: string): string {
  const courseId =
    readOptionalStringField(record, ["ID", "id", "courseId", "course_id"]) ?? fallbackId;

  return `course:${courseId}`;
}

function sumParsFromNode(node: unknown): { sum: number; count: number } {
  if (Array.isArray(node)) {
    return node.reduce(
      (acc, item) => {
        const nested = sumParsFromNode(item);
        return {
          sum: acc.sum + nested.sum,
          count: acc.count + nested.count,
        };
      },
      { sum: 0, count: 0 },
    );
  }

  const objectNode = toObject(node);

  if (!objectNode) {
    return { sum: 0, count: 0 };
  }

  let sum = 0;
  let count = 0;
  const directPar = readOptionalNumberField(objectNode, [
    "Par",
    "par",
    "holePar",
    "hole_par",
  ]);

  if (directPar !== undefined) {
    sum += directPar;
    count += 1;
  }

  for (const [key, value] of Object.entries(objectNode)) {
    if (
      directPar !== undefined &&
      (key === "Par" || key === "par" || key === "holePar" || key === "hole_par")
    ) {
      continue;
    }

    if (Array.isArray(value) && HOLE_COLLECTION_KEYS.has(key)) {
      const nested = sumParsFromNode(value);
      sum += nested.sum;
      count += nested.count;
      continue;
    }

    if (!Array.isArray(value) && typeof value === "object" && value !== null) {
      const nested = sumParsFromNode(value);
      sum += nested.sum;
      count += nested.count;
    }
  }

  return { sum, count };
}

function findBasketsCountInNode(node: unknown): number | undefined {
  if (Array.isArray(node)) {
    for (const item of node) {
      const nestedCount = findBasketsCountInNode(item);

      if (nestedCount !== undefined) {
        return nestedCount;
      }
    }

    return undefined;
  }

  const objectNode = toObject(node);

  if (!objectNode) {
    return undefined;
  }

  if (Array.isArray(objectNode.baskets)) {
    return objectNode.baskets.length;
  }

  for (const [key, value] of Object.entries(objectNode)) {
    if (key === "baskets" && Array.isArray(value)) {
      continue;
    }

    if (Array.isArray(value) || (typeof value === "object" && value !== null)) {
      const nestedCount = findBasketsCountInNode(value);

      if (nestedCount !== undefined) {
        return nestedCount;
      }
    }
  }

  return undefined;
}

export function calculateCoursePar(
  record: DiscGolfMetrixRawCourseRecord,
): number | undefined {
  const nested = sumParsFromNode(record);

  if (nested.count > 0) {
    return nested.sum;
  }

  const unwrapped = unwrapCourseRecord(record);

  return readOptionalNumberField(unwrapped, ["coursePar", "course_par", "par"]);
}

export function calculateBasketsCount(
  record: DiscGolfMetrixRawCourseRecord,
): number | undefined {
  const topLevelCount = findBasketsCountInNode(record);

  if (topLevelCount !== undefined) {
    return topLevelCount;
  }

  const unwrapped = unwrapCourseRecord(record);
  const unwrappedCount = findBasketsCountInNode(unwrapped);

  return unwrappedCount;
}

export function mapDiscGolfMetrixCourseRecord(
  record: DiscGolfMetrixRawCourseRecord,
  fallbackCourseId = "unknown",
):
  | { ok: true; course: Course }
  | { ok: false; issue: UpdateProcessingIssue } {
  const unwrapped = unwrapCourseRecord(record);
  const recordKey = buildRecordKey(unwrapped, fallbackCourseId);
  const courseId =
    readOptionalStringField(unwrapped, ["ID", "id", "courseId", "course_id"]) ??
    fallbackCourseId;

  if (!courseId) {
    return { ok: false, issue: createCourseIssue(recordKey, "courseId") };
  }

  const name = readOptionalStringField(unwrapped, [
    "Name",
    "name",
    "courseName",
    "course_name",
  ]);

  if (!name) {
    return { ok: false, issue: createCourseIssue(recordKey, "name") };
  }

  const coursePar = calculateCoursePar(record);
  const basketsCount = calculateBasketsCount(record);

  if (coursePar === undefined) {
    return { ok: false, issue: createCourseIssue(recordKey, "course_par") };
  }

  if (basketsCount === undefined) {
    return { ok: false, issue: createCourseIssue(recordKey, "baskets_count") };
  }

  return {
    ok: true,
    course: {
      courseId,
      name,
      fullname:
        readOptionalStringField(unwrapped, [
          "Fullname",
          "fullname",
          "fullName",
          "full_name",
        ]) ?? null,
      type:
        readOptionalStringField(unwrapped, ["Type", "type", "courseType", "course_type"]) ??
        null,
      countryCode:
        readOptionalStringField(unwrapped, ["CountryCode", "countryCode", "country_code"]) ??
        null,
      area: readOptionalStringField(unwrapped, ["Area", "area", "region"]) ?? null,
      ratingValue1:
        readOptionalNumberField(unwrapped, ["RatingValue1", "ratingValue1", "rating_value1"]) ??
        null,
      ratingResult1:
        readOptionalNumberField(unwrapped, [
          "RatingResult1",
          "ratingResult1",
          "rating_result1",
        ]) ?? null,
      ratingValue2:
        readOptionalNumberField(unwrapped, ["RatingValue2", "ratingValue2", "rating_value2"]) ??
        null,
      ratingResult2:
        readOptionalNumberField(unwrapped, [
          "RatingResult2",
          "ratingResult2",
          "rating_result2",
        ]) ?? null,
      coursePar,
      basketsCount,
    },
  };
}
