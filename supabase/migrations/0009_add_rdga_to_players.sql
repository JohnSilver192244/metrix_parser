alter table if exists app_public.players
  add column if not exists rdga boolean default false;
