alter table public.pam
  add column if not exists pdf_data bytea,
  add column if not exists pdf_filename text,
  add column if not exists pdf_generated_at timestamptz,
  add column if not exists gmail_draft_id text,
  add column if not exists gmail_draft_created_at timestamptz;

create table if not exists public.gmail_oauth_connection (
  singleton boolean primary key default true check (singleton),
  account_email text,
  encrypted_refresh_token text not null,
  connected_by uuid references public.users(id) on delete set null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
