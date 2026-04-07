-- Purpose: clear derived season standings so season points can be recalculated
-- from the UI against the current source data.

delete from app_public.season_standings;
