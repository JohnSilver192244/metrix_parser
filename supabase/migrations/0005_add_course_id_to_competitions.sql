-- Story 3.x follow-up
-- Purpose: persist stable park identifiers on competitions so the courses
-- pipeline can discover parks without re-reading raw source payloads.

alter table if exists app_public.competitions
  add column if not exists course_id text;

update app_public.competitions
set course_id = coalesce(
  raw_payload ->> 'CourceID',
  raw_payload ->> 'CourseID',
  raw_payload ->> 'courseId',
  raw_payload ->> 'course_id',
  raw_payload ->> 'courseid',
  raw_payload ->> 'layoutId',
  raw_payload ->> 'layout_id',
  raw_payload -> 'course' ->> 'ID',
  raw_payload -> 'course' ->> 'id',
  raw_payload -> 'course' ->> 'courseId',
  raw_payload -> 'course' ->> 'course_id'
)
where course_id is null;

create index if not exists competitions_course_id_idx
  on app_public.competitions (course_id);
