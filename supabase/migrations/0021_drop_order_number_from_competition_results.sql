alter table app_public.competition_results
  drop constraint if exists competition_results_competition_player_order_key;

with ranked_results as (
  select
    id,
    row_number() over (
      partition by competition_id, player_id
      order by
        (sum is not null) desc,
        (diff is not null) desc,
        coalesce(source_fetched_at, updated_at, created_at) desc,
        id desc
    ) as duplicate_rank
  from app_public.competition_results
),
duplicate_results as (
  select id
  from ranked_results
  where duplicate_rank > 1
)
delete from app_public.competition_results target
using duplicate_results duplicates
where target.id = duplicates.id;

alter table app_public.competition_results
  drop column if exists order_number;

alter table app_public.competition_results
  drop constraint if exists competition_results_competition_player_key;

alter table app_public.competition_results
  add constraint competition_results_competition_player_key
  unique (competition_id, player_id);
