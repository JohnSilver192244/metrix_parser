create table if not exists app_public.update_jobs (
  job_id text primary key,
  user_login text null references app_public.app_users(login) on delete set null,
  operation text not null,
  status text not null,
  message text not null,
  requested_at timestamptz not null default now(),
  started_at timestamptz null,
  finished_at timestamptz null,
  period_date_from date null,
  period_date_to date null,
  overwrite_existing boolean not null default false,
  poll_path text not null,
  continuation_cursor jsonb null,
  result_payload jsonb null,
  processing_lease_token text null
);

alter table app_public.update_jobs
  add column if not exists processing_lease_token text null;

create index if not exists update_jobs_user_login_requested_at_idx
  on app_public.update_jobs (user_login, requested_at desc);

create index if not exists update_jobs_status_requested_at_idx
  on app_public.update_jobs (status, requested_at desc);
