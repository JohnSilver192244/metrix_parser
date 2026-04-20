alter table app_public.update_jobs
  add column if not exists progress_payload jsonb null;
