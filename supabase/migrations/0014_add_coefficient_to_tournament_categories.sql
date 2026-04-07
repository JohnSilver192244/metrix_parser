-- Story 2.6
-- Purpose: add coefficient to manually managed tournament categories after the
-- initial table migration has already been applied.

alter table if exists app_public.tournament_categories
  add column if not exists coefficient numeric(10, 2);

update app_public.tournament_categories
set coefficient = 1.00
where coefficient is null;

alter table if exists app_public.tournament_categories
  alter column coefficient set not null;

alter table if exists app_public.tournament_categories
  drop constraint if exists tournament_categories_coefficient_check;

alter table if exists app_public.tournament_categories
  add constraint tournament_categories_coefficient_check
  check (coefficient >= 0);
