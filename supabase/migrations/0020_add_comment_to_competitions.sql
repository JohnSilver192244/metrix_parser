-- Purpose: store a single user-facing blocker comment on visible competitions.

alter table if exists app_public.competitions
  add column if not exists comment text;

alter table if exists app_public.competitions
  drop constraint if exists competitions_comment_length_check;

alter table if exists app_public.competitions
  add constraint competitions_comment_length_check check (
    comment is null or char_length(comment) <= 2000
  );
