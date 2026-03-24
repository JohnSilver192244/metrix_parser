import {
  createUpdateIssue,
  resolveRecordAction,
  toCourseDbRecord,
  type Course,
  type CourseDbRecord,
  type UpdateProcessingIssue,
  type UpdateRecordResult,
} from "@metrix-parser/shared-types";

export interface CourseRow extends CourseDbRecord {
  id: number;
}

export interface StoredCourseRecord extends CourseDbRecord {
  raw_payload: Record<string, unknown> | null;
  source_fetched_at: string | null;
}

export interface PersistableCourseRecord {
  course: Course;
  rawPayload: Record<string, unknown> | null;
  sourceFetchedAt: string | null;
}

export interface CoursesPersistenceAdapter {
  findByCourseId(courseId: string): Promise<CourseRow | null>;
  insert(record: StoredCourseRecord): Promise<CourseRow>;
  update(id: number, record: StoredCourseRecord): Promise<CourseRow>;
}

export interface CoursesRepository {
  saveCourse(record: PersistableCourseRecord): Promise<UpdateRecordResult>;
}

function createCourseIssue(
  code: string,
  message: string,
  stage: UpdateProcessingIssue["stage"],
  recordKey: string,
): UpdateProcessingIssue {
  return createUpdateIssue({
    code,
    message,
    recoverable: true,
    stage,
    recordKey,
  });
}

function toStoredCourseRecord(record: PersistableCourseRecord): StoredCourseRecord {
  return {
    ...toCourseDbRecord(record.course),
    raw_payload: record.rawPayload,
    source_fetched_at: record.sourceFetchedAt,
  };
}

export function createCoursesRepository(
  adapter: CoursesPersistenceAdapter,
): CoursesRepository {
  return {
    async saveCourse(record) {
      const recordKey = `course:${record.course.courseId}`;

      if (record.course.courseId.trim().length === 0) {
        return {
          action: "skipped",
          matchedExisting: false,
          issue: createCourseIssue(
            "course_missing_identity",
            "Перед сохранением у парка должен быть courseId.",
            "validation",
            recordKey,
          ),
        };
      }

      const existingRow = await adapter.findByCourseId(record.course.courseId);
      const dbRecord = toStoredCourseRecord(record);

      if (!existingRow) {
        await adapter.insert(dbRecord);

        return {
          action: "created",
          matchedExisting: false,
        };
      }

      await adapter.update(existingRow.id, dbRecord);

      return {
        action: resolveRecordAction(true),
        matchedExisting: true,
      };
    },
  };
}
