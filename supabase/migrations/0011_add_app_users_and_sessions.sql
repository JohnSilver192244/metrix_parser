create table if not exists app_public.app_users (
  login text primary key,
  password text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists app_public.user_sessions (
  session_token text primary key,
  user_login text not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint user_sessions_user_login_fkey
    foreign key (user_login) references app_public.app_users (login)
    on delete cascade
);

create index if not exists user_sessions_user_login_idx
  on app_public.user_sessions (user_login);
