-- Story 4.x follow-up
-- Purpose: let admins assign an optional tournament category to a saved
-- competition while keeping the reference nullable and safe to clear.

alter table if exists app_public.competitions
  add column if not exists category_id text;

alter table if exists app_public.competitions
  drop constraint if exists competitions_category_id_fkey;

alter table if exists app_public.competitions
  add constraint competitions_category_id_fkey
  foreign key (category_id)
  references app_public.tournament_categories (category_id)
  on delete set null;

create index if not exists competitions_category_id_idx
  on app_public.competitions (category_id);
