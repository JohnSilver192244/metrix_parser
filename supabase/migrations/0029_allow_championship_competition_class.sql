-- Purpose: support championship categories (ЧР) for season-credit selection.
alter table if exists app_public.tournament_categories
  drop constraint if exists tournament_categories_competition_class_check;

alter table if exists app_public.tournament_categories
  add constraint tournament_categories_competition_class_check
  check (competition_class in ('league', 'tournament', 'championship'));
