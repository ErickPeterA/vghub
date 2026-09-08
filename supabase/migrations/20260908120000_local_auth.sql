alter table public.users
  add column if not exists password_hash text,
  add column if not exists password_changed_at timestamptz;

create table if not exists public.auth_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  user_agent text,
  ip_address text,
  constraint auth_sessions_expiry_after_creation check (expires_at > created_at)
);

create index if not exists auth_sessions_user_active_idx
  on public.auth_sessions (user_id, expires_at)
  where revoked_at is null;

create index if not exists auth_sessions_expiry_idx
  on public.auth_sessions (expires_at);

