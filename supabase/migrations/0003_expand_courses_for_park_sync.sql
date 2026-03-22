-- Story 2.5
-- Purpose: extend the initial courses table with the fields required for
-- park synchronization, course_par aggregation, and source payload tracing.

alter table if exists app_public.courses
  rename column course_name to name;

alter table if exists app_public.courses
  add column if not exists fullname text,
  add column if not exists type text,
  add column if not exists country_code text,
  add column if not exists area text,
  add column if not exists rating_value1 double precision,
  add column if not exists rating_result1 integer,
  add column if not exists rating_value2 double precision,
  add column if not exists rating_result2 integer,
  add column if not exists course_par integer,
  add column if not exists raw_payload jsonb,
  add column if not exists source_fetched_at timestamptz;

alter table if exists app_public.courses
  alter column name set not null;

create index if not exists courses_course_par_idx
  on app_public.courses (course_par);
