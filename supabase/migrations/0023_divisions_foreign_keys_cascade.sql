do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'app_public'
      and table_name = 'players'
  ) then
    alter table app_public.players
      drop constraint if exists players_division_fkey;

    alter table app_public.players
      add constraint players_division_fkey
      foreign key (division)
      references app_public.divisions (code)
      on update cascade
      on delete set null;

    alter table app_public.players
      drop constraint if exists players_season_division_fkey;

    alter table app_public.players
      add constraint players_season_division_fkey
      foreign key (season_division)
      references app_public.divisions (code)
      on update cascade
      on delete set null;
  end if;
end $$;
