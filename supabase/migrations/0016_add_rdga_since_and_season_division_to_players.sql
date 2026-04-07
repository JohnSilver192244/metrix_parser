alter table if exists app_public.players
  add column if not exists rdga_since date,
  add column if not exists season_division text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'players_season_division_fkey'
  ) then
    alter table app_public.players
      add constraint players_season_division_fkey
      foreign key (season_division) references app_public.divisions (code);
  end if;
end $$;
