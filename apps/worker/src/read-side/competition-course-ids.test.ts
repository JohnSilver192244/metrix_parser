import assert from "node:assert/strict";
import test from "node:test";

import {
  createCompetitionCourseIdsReader,
  extractCourseIdFromCompetitionPayload,
} from "./competition-course-ids";

test("extractCourseIdFromCompetitionPayload supports flat and nested payload shapes", () => {
  assert.equal(extractCourseIdFromCompetitionPayload({ CourceID: "course-101" }), "course-101");
  assert.equal(
    extractCourseIdFromCompetitionPayload({ course: { ID: "course-202" } }),
    "course-202",
  );
});

test("competition course id reader deduplicates course ids and reports missing references", async () => {
  const reader = createCompetitionCourseIdsReader({
    async listCompetitionSources() {
      return [
        {
          competition_id: "competition-101",
          course_id: "course-101",
          raw_payload: { CourceID: "course-legacy" },
        },
        {
          competition_id: "competition-102",
          course_id: null,
          raw_payload: { CourceID: "course-101" },
        },
        {
          competition_id: "competition-103",
          course_id: null,
          raw_payload: null,
        },
      ];
    },
  });

  const result = await reader.readCourseIds();

  assert.deepEqual(result.courseIds, ["course-101"]);
  assert.equal(result.skippedCount, 1);
  assert.equal(result.issues.length, 1);
  assert.equal(result.issues[0]?.recordKey, "competition:competition-103");
});
