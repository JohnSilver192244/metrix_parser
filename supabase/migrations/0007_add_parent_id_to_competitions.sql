-- Story 3.x follow-up
-- Purpose: persist DiscGolfMetrix ParentID for competitions so grouped rounds
-- and parent-child event relationships remain available after ingestion.

alter table if exists app_public.competitions
  add column if not exists parent_id text;

update app_public.competitions
set parent_id = coalesce(
  raw_payload ->> 'ParentID',
  raw_payload ->> 'parentId',
  raw_payload ->> 'parent_id'
)
where parent_id is null;

create index if not exists competitions_parent_id_idx
  on app_public.competitions (parent_id);
