-- Story 2.5
-- Purpose: persist basket count for synced courses alongside course_par.

alter table if exists app_public.courses
  add column if not exists baskets_count integer;
