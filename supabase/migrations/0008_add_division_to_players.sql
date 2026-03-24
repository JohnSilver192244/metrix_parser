alter table if exists app_public.players
  add column if not exists division text;

create table if not exists app_public.divisions (
  code text primary key
);

insert into app_public.divisions (code)
values
  ('MPO'),
  ('FPO'),
  ('MP40'),
  ('FP40'),
  ('MA1'),
  ('MA2')
on conflict (code) do nothing;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'players_division_fkey'
  ) then
    alter table app_public.players
      add constraint players_division_fkey
      foreign key (division) references app_public.divisions (code);
  end if;
end $$;
