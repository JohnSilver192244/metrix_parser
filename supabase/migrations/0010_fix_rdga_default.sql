alter table if exists app_public.players
  alter column rdga set default false;

update app_public.players
set rdga = false
where rdga is null;
