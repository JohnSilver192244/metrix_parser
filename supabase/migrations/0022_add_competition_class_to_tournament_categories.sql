-- Purpose: explicitly classify tournament categories as league or tournament
-- so season credit points are derived from deterministic category metadata.

alter table if exists app_public.tournament_categories
  add column if not exists competition_class text;

update app_public.tournament_categories
set competition_class = 'tournament'
where competition_class is null;

alter table if exists app_public.tournament_categories
  alter column competition_class set default 'tournament';

alter table if exists app_public.tournament_categories
  alter column competition_class set not null;

alter table if exists app_public.tournament_categories
  drop constraint if exists tournament_categories_competition_class_check;

alter table if exists app_public.tournament_categories
  add constraint tournament_categories_competition_class_check
  check (competition_class in ('league', 'tournament'));
