-- Story 3.x follow-up
-- Purpose: align course rating result columns with live DiscGolfMetrix payloads,
-- which return fractional values such as 80.96 and 62.13.

alter table if exists app_public.courses
  alter column rating_result1 type double precision
    using rating_result1::double precision,
  alter column rating_result2 type double precision
    using rating_result2::double precision;
