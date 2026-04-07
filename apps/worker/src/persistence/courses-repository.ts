import {
  accumulateUpdateSummary,
  createEmptyUpdateSummary,
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
  findByCourseIds(courseIds: string[]): Promise<CourseRow[]>;
  insert(record: StoredCourseRecord): Promise<CourseRow>;
  update(id: number, record: StoredCourseRecord): Promise<CourseRow>;
  upsert(records: StoredCourseRecord[]): Promise<CourseRow[]>;
}

export interface CoursesRepository {
  saveCourse(
    record: PersistableCourseRecord,
    options?: { overwriteExisting?: boolean },
  ): Promise<UpdateRecordResult>;
  saveCourses(
    records: PersistableCourseRecord[],
    options?: { overwriteExisting?: boolean },
  ): Promise<{
    summary: ReturnType<typeof createEmptyUpdateSummary>;
    issues: UpdateProcessingIssue[];
  }>;
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

function normalizeRecordResult(recordResult: UpdateRecordResult): UpdateRecordResult {
  return recordResult.issue && recordResult.action !== "skipped"
    ? { ...recordResult, action: "skipped" as const }
    : recordResult;
}

export function createCoursesRepository(
  adapter: CoursesPersistenceAdapter,
): CoursesRepository {
  async function saveCourse(
    record: PersistableCourseRecord,
    options: { overwriteExisting?: boolean } = {},
  ): Promise<UpdateRecordResult> {
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

    if (options.overwriteExisting !== true) {
      return {
        action: "skipped",
        matchedExisting: true,
      };
    }

    await adapter.update(existingRow.id, dbRecord);

    return {
      action: resolveRecordAction(true),
      matchedExisting: true,
    };
  }

  return {
    saveCourse,
    async saveCourses(records, options = {}) {
      let summary = createEmptyUpdateSummary();
      const issues: UpdateProcessingIssue[] = [];
      const validRecords: PersistableCourseRecord[] = [];

      for (const record of records) {
        const normalized = normalizeRecordResult(await saveCourseValidation(record));

        if (normalized.action === "skipped") {
          summary = accumulateUpdateSummary(summary, normalized);

          if (normalized.issue) {
            issues.push(normalized.issue);
          }
          continue;
        }

        validRecords.push(record);
      }

      if (validRecords.length === 0) {
        return { summary, issues };
      }

      const validationSummary = { ...summary };
      const validationIssues = [...issues];

      try {
        const courseIds = [...new Set(validRecords.map((record) => record.course.courseId))];
        const existingRows = await adapter.findByCourseIds(courseIds);
        const existingRowsByCourseId = new Map(
          existingRows.map((row) => [row.course_id, row] as const),
        );
        const recordsToUpsert = validRecords.filter(
          (record) =>
            options.overwriteExisting === true ||
            !existingRowsByCourseId.has(record.course.courseId),
        );

        if (recordsToUpsert.length > 0) {
          await adapter.upsert(
            recordsToUpsert.map((record) => toStoredCourseRecord(record)),
          );
        }

        for (const record of validRecords) {
          const matchedExisting = existingRowsByCourseId.has(record.course.courseId);
          summary = accumulateUpdateSummary(summary, {
            action: matchedExisting
              ? (options.overwriteExisting === true ? "updated" : "skipped")
              : "created",
            matchedExisting,
          });
        }

        return { summary, issues };
      } catch {
        summary = { ...validationSummary };
        issues.length = 0;
        issues.push(...validationIssues);

        for (const record of validRecords) {
          const normalized = normalizeRecordResult(await saveCourse(record, options));
          summary = accumulateUpdateSummary(summary, normalized);

          if (normalized.issue) {
            issues.push(normalized.issue);
          }
        }

        return { summary, issues };
      }
    },
  };
}

async function saveCourseValidation(
  record: PersistableCourseRecord,
): Promise<UpdateRecordResult> {
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

  return {
    action: "created",
    matchedExisting: false,
  };
}
