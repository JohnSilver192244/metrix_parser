-- Remove duplicated minimum players threshold from seasons.
-- Season points eligibility now relies on scoring entity players_count and points matrix.

alter table app_public.seasons
  drop column if exists min_players;
