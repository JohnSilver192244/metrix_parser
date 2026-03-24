import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  CourseRow,
  CoursesPersistenceAdapter,
  StoredCourseRecord,
} from "./courses-repository";

const COURSES_SELECT_COLUMNS =
  "id, course_id, name, fullname, type, country_code, area, rating_value1, rating_result1, rating_value2, rating_result2, course_par, raw_payload, source_fetched_at";
const APP_PUBLIC_SCHEMA = "app_public";

export function createSupabaseCoursesAdapter(
  supabase: SupabaseClient,
): CoursesPersistenceAdapter {
  return {
    async findByCourseId(courseId) {
      const { data, error } = await supabase
        .schema(APP_PUBLIC_SCHEMA)
        .from("courses")
        .select(COURSES_SELECT_COLUMNS)
        .eq("course_id", courseId)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to load course by course_id: ${error.message}`);
      }

      return data as CourseRow | null;
    },

    async insert(record: StoredCourseRecord) {
      const { data, error } = await supabase
        .schema(APP_PUBLIC_SCHEMA)
        .from("courses")
        .insert(record)
        .select(COURSES_SELECT_COLUMNS)
        .single();

      if (error) {
        throw new Error(`Failed to insert course: ${error.message}`);
      }

      return data as CourseRow;
    },

    async update(id, record: StoredCourseRecord) {
      const { data, error } = await supabase
        .schema(APP_PUBLIC_SCHEMA)
        .from("courses")
        .update(record)
        .eq("id", id)
        .select(COURSES_SELECT_COLUMNS)
        .single();

      if (error) {
        throw new Error(`Failed to update course ${id}: ${error.message}`);
      }

      return data as CourseRow;
    },
  };
}
