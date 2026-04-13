-- P2 baseline profiling script.
-- Portable SQL (works in Supabase SQL Editor and psql).
-- Replace sample IDs if they are missing in your environment.

-- 1) player_id + competition_id lookup
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT competition_id, player_id, sum, dnf
FROM app_public.competition_results
WHERE player_id = '145005'
  AND competition_id = '3445550';

-- 2) ranking path: competition_id, dnf, sum, player_id
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT competition_id, player_id, sum, dnf
FROM app_public.competition_results
WHERE competition_id = '3445550'
ORDER BY dnf ASC, sum ASC NULLS LAST, player_id ASC
LIMIT 200;

-- 3) season_code + competition_id filter
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT competition_id, player_id, season_code, season_points
FROM app_public.season_standings
WHERE season_code = '2026'
  AND competition_id = '3535329';

-- 4) season_code + player_id filter
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT competition_id, player_id, season_code, season_points
FROM app_public.season_standings
WHERE season_code = '2026'
  AND player_id = '145005';

-- 5) count(*) / count(distinct) hotspot check
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT count(DISTINCT competition_id)::integer
FROM app_public.competition_results
WHERE player_id = '145005';
