import assert from "node:assert/strict";
import test from "node:test";

import type { Course } from "@metrix-parser/shared-types";

import {
  createCoursesRepository,
  type CourseRow,
  type CoursesPersistenceAdapter,
  type StoredCourseRecord,
} from "./courses-repository";

function createCourse(overrides: Partial<Course> = {}): Course {
  return {
    courseId: "course-101",
    name: "Tiraz Park",
    fullname: "Tiraz Park Championship Layout",
    type: "18-hole",
    countryCode: "RU",
    area: "Moscow",
    ratingValue1: 4.7,
    ratingResult1: 128,
    ratingValue2: 4.5,
    ratingResult2: 56,
    coursePar: 54,
    ...overrides,
  };
}

function createStoredRow(overrides: Partial<CourseRow> = {}): CourseRow {
  return {
    id: 1,
    course_id: "course-101",
    name: "Tiraz Park",
    fullname: "Tiraz Park Championship Layout",
    type: "18-hole",
    country_code: "RU",
    area: "Moscow",
    rating_value1: 4.7,
    rating_result1: 128,
    rating_value2: 4.5,
    rating_result2: 56,
    course_par: 54,
    ...overrides,
  };
}

class InMemoryCoursesAdapter implements CoursesPersistenceAdapter {
  private rows: CourseRow[];
  private nextId: number;

  constructor(initialRows: CourseRow[] = []) {
    this.rows = [...initialRows];
    this.nextId = initialRows.reduce((maxId, row) => Math.max(maxId, row.id), 0) + 1;
  }

  async findByCourseId(courseId: string): Promise<CourseRow | null> {
    return this.rows.find((row) => row.course_id === courseId) ?? null;
  }

  async insert(record: StoredCourseRecord): Promise<CourseRow> {
    const created = { id: this.nextId++, ...record } as CourseRow;
    this.rows.push(created);
    return created;
  }

  async update(id: number, record: StoredCourseRecord): Promise<CourseRow> {
    const index = this.rows.findIndex((row) => row.id === id);

    if (index < 0) {
      throw new Error(`Course row ${id} not found`);
    }

    const updated = { id, ...record } as CourseRow;
    this.rows[index] = updated;
    return updated;
  }

  snapshot() {
    return [...this.rows];
  }
}

test("repository creates a new course when no existing record matches", async () => {
  const adapter = new InMemoryCoursesAdapter();
  const repository = createCoursesRepository(adapter);

  const result = await repository.saveCourse({
    course: createCourse(),
    rawPayload: { id: "course-101" },
    sourceFetchedAt: "2026-03-21T12:00:00.000Z",
  });

  assert.equal(result.action, "created");
  assert.equal(result.matchedExisting, false);
  assert.equal(adapter.snapshot().length, 1);
});

test("repository treats repeat-run of the same course as update without creating duplicates", async () => {
  const adapter = new InMemoryCoursesAdapter([createStoredRow()]);
  const repository = createCoursesRepository(adapter);

  const result = await repository.saveCourse({
    course: createCourse({ coursePar: 56 }),
    rawPayload: { id: "course-101" },
    sourceFetchedAt: "2026-03-21T12:00:00.000Z",
  });

  assert.equal(result.action, "updated");
  assert.equal(result.matchedExisting, true);
  assert.equal(adapter.snapshot().length, 1);
  assert.equal(adapter.snapshot()[0]?.course_par, 56);
});

test("repository skips problematic course records with missing stable identifiers", async () => {
  const adapter = new InMemoryCoursesAdapter();
  const repository = createCoursesRepository(adapter);

  const result = await repository.saveCourse({
    course: createCourse({ courseId: " " }),
    rawPayload: { id: "course-101" },
    sourceFetchedAt: "2026-03-21T12:00:00.000Z",
  });

  assert.equal(result.action, "skipped");
  assert.equal(result.issue?.code, "course_missing_identity");
  assert.equal(adapter.snapshot().length, 0);
});
