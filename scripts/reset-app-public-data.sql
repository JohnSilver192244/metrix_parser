begin;

-- Clears parser-managed entities and resets identity sequences so the next
-- import starts from a clean state.
-- Authentication tables are intentionally left intact so manually created
-- logins survive data resets.
truncate table
  app_public.competition_results,
  app_public.competitions,
  app_public.courses,
  app_public.players
restart identity;

commit;
