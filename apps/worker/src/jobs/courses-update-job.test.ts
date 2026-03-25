import assert from "node:assert/strict";
import test from "node:test";

import type { CourseDbRecord } from "@metrix-parser/shared-types";

import { runCoursesUpdateJob } from "./courses-update-job";
import { createCoursesRepository } from "../persistence/courses-repository";
import { createMockResponse } from "../test-support/mock-response";
import type { StoredCourseRecord } from "../persistence/courses-repository";

class InMemoryCoursesAdapter {
  private rows: Array<CourseDbRecord & { id: number }> = [];
  private nextId = 1;

  async findByCourseId(courseId: string) {
    return this.rows.find((row) => row.course_id === courseId) ?? null;
  }

  async insert(record: StoredCourseRecord) {
    const created = { id: this.nextId++, ...record };
    this.rows.push(created);
    return created;
  }

  async update(id: number, record: StoredCourseRecord) {
    const index = this.rows.findIndex((row) => row.id === id);
    const updated = { id, ...record };
    this.rows[index] = updated;
    return updated;
  }
}

test("runCoursesUpdateJob discovers course ids, persists valid courses, and reports summary counts", async () => {
  const repository = createCoursesRepository(new InMemoryCoursesAdapter());
  const result = await runCoursesUpdateJob({
    baseUrl: "https://discgolfmetrix.com",
    countryCode: "RU",
    apiCode: "secret-code",
    repository,
    readCourseIds: async () => ({
      courseIds: ["course-101", "course-202"],
      skippedCount: 0,
      issues: [],
    }),
    fetchImpl: async (input) => {
      const url = String(input);

      if (url.includes("id=course-101")) {
        return createMockResponse(
          JSON.stringify({
            course: {
              ID: "course-101",
              Name: "Tiraz Park",
            },
            baskets: [{ Par: "3" }, { Par: "4" }, { Par: "5" }],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

        return createMockResponse(
          JSON.stringify({
            course: {
              ID: "course-202",
              Name: "Primorsky Park",
              layout: {
                holes: [{ Par: "3" }, { Par: "3" }, { Par: "4" }],
              },
            },
            baskets: [{ Number: "1" }, { Number: "2" }, { Number: "3" }],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
    },
  });

  assert.equal(result.finalStatus, "completed");
  assert.deepEqual(result.summary, {
    found: 2,
    created: 2,
    updated: 0,
    skipped: 0,
    errors: 0,
  });
  assert.deepEqual(result.discoveredCourseIds, ["course-101", "course-202"]);
  assert.equal(result.fetchedCoursesCount, 2);
});

test("runCoursesUpdateJob isolates broken course fetches and incomplete payloads", async () => {
  const repository = createCoursesRepository(new InMemoryCoursesAdapter());
  const result = await runCoursesUpdateJob({
    baseUrl: "https://discgolfmetrix.com",
    countryCode: "RU",
    apiCode: "secret-code",
    repository,
    readCourseIds: async () => ({
      courseIds: ["course-101", "course-bad", "course-missing"],
      skippedCount: 1,
      issues: [
        {
          code: "competition_missing_course_reference",
          message: "competition missing course id",
          recoverable: true,
          stage: "validation",
          recordKey: "competition:broken",
        },
      ],
    }),
    fetchImpl: async (input) => {
      const url = String(input);

      if (url.includes("id=course-101")) {
        return createMockResponse(
          JSON.stringify({
            course: {
              ID: "course-101",
              Name: "Tiraz Park",
            },
            baskets: [{ Par: "3" }, { Par: "4" }],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      if (url.includes("id=course-bad")) {
        return createMockResponse(
          JSON.stringify({
            course: {
              ID: "course-bad",
              Fullname: "Broken course",
            },
            baskets: [{ Length: "70" }],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      return createMockResponse("missing", { status: 404 });
    },
  });

  assert.equal(result.finalStatus, "completed_with_issues");
  assert.deepEqual(result.summary, {
    found: 3,
    created: 1,
    updated: 0,
    skipped: 3,
    errors: 3,
  });
  assert.equal(result.issues.length, 3);
});
