-- P2 SQL optimization: composite indexes for real filters, joins and ranking paths.

-- Supports:
-- - count(distinct competition_id) where player_id = ?
-- - lookups constrained by player_id + competition_id
create index if not exists competition_results_player_competition_idx
  on app_public.competition_results (player_id, competition_id);

-- Supports:
-- - ranking/order by competition_id, dnf, sum, player_id
-- - paged results sorted by the same leading keyset
create index if not exists competition_results_ranking_idx
  on app_public.competition_results (competition_id, dnf, sum, player_id);

-- Supports:
-- - season_standings filters by season_code + player_id
-- - follow-up grouping/join by competition_id
create index if not exists season_standings_season_player_competition_idx
  on app_public.season_standings (season_code, player_id, competition_id);

-- Existing unique index on (season_code, competition_id, player_id)
-- already covers season_code + competition_id lookups.

-- Supports COUNT/EXISTS over hierarchy traversals in resolve_owner_competition_id()
-- where parent_id and record_type are filtered together.
create index if not exists competitions_parent_record_type_idx
  on app_public.competitions (parent_id, record_type);
