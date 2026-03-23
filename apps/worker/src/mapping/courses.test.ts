import assert from "node:assert/strict";
import test from "node:test";

import { toCourseDbRecord } from "@metrix-parser/shared-types";

import {
  brokenCourseFixture,
  nestedCourseFixture,
  validCourseFixture,
} from "./__fixtures__/courses";
import { calculateCoursePar, mapDiscGolfMetrixCourseRecord } from "./courses";

test("mapDiscGolfMetrixCourseRecord maps required course fields and calculates course_par", () => {
  const result = mapDiscGolfMetrixCourseRecord(validCourseFixture);

  assert.equal(result.ok, true);

  if (!result.ok) {
    return;
  }

  assert.deepEqual(result.course, {
    courseId: "course-101",
    name: "Tiraz Park",
    fullname: "Tiraz Park Championship Layout",
    type: "2",
    countryCode: "RU",
    area: "Moscow",
    ratingValue1: 845.92,
    ratingResult1: 56.41,
    ratingValue2: 1000,
    ratingResult2: 43.57,
    coursePar: 12,
  });
  assert.deepEqual(toCourseDbRecord(result.course), {
    course_id: "course-101",
    name: "Tiraz Park",
    fullname: "Tiraz Park Championship Layout",
    type: "2",
    country_code: "RU",
    area: "Moscow",
    rating_value1: 845.92,
    rating_result1: 56.41,
    rating_value2: 1000,
    rating_result2: 43.57,
    course_par: 12,
  });
});

test("calculateCoursePar supports nested course payloads", () => {
  assert.equal(calculateCoursePar(nestedCourseFixture), 10);
});

test("mapDiscGolfMetrixCourseRecord skips incomplete course payloads without crashing the batch", () => {
  const result = mapDiscGolfMetrixCourseRecord(brokenCourseFixture);

  assert.equal(result.ok, false);

  if (result.ok) {
    return;
  }

  assert.equal(result.issue.code, "invalid_course_record");
  assert.equal(result.issue.stage, "validation");
  assert.equal(result.issue.recordKey, "course:course-bad");
});
