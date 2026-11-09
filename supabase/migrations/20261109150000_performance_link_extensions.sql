create table if not exists public.performance_link_extensions (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.performance_review_participants(id) on delete cascade,
  review_id uuid not null references public.performance_reviews(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  previous_expires_at timestamptz not null,
  extended_expires_at timestamptz not null,
  justification text not null check (length(trim(justification)) >= 10),
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists performance_link_extensions_review_idx
  on public.performance_link_extensions(review_id, created_at desc);

create index if not exists performance_link_extensions_participant_idx
  on public.performance_link_extensions(participant_id, created_at desc);
