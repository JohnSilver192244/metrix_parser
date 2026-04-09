begin;

-- Delete dependent rows first to avoid FK violations.
with deleted_season_standings as (
  delete from app_public.season_standings
  where competition_id = '3234152'
  returning 1
),
deleted_competition_results as (
  delete from app_public.competition_results
  where competition_id = '3234152'
  returning 1
),
deleted_competitions as (
  delete from app_public.competitions
  where competition_id = '3234152'
  returning 1
)
select
  (select count(*) from deleted_season_standings) as deleted_season_standings,
  (select count(*) from deleted_competition_results) as deleted_competition_results,
  (select count(*) from deleted_competitions) as deleted_competitions;

commit;
