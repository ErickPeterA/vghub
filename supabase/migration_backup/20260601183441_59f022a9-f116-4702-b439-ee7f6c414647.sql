
-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now()
);

grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create policy "Profiles: self read" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "Profiles: self insert" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "Profiles: self update" on public.profiles for update to authenticated using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Descricoes de Cargo
create table public.descricoes_cargo (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Cabeçalho
  cargo text not null,
  unidade_negocio text,
  departamento text,
  nivelamento text,
  superior_imediato text,
  tipo_carreira text,
  data_versao date,
  data_revisao date,
  status text not null default 'rascunho',
  objetivo text,

  -- Seções estruturadas (arrays de objetos)
  instrucao jsonb not null default '[]'::jsonb,
  experiencia jsonb not null default '[]'::jsonb,
  conhecimento jsonb not null default '[]'::jsonb,
  atividades jsonb not null default '[]'::jsonb,
  indicadores jsonb not null default '[]'::jsonb,
  habilidades_cargo jsonb not null default '[]'::jsonb,
  habilidades_culturais jsonb not null default '[]'::jsonb,
  postura jsonb not null default '[]'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.descricoes_cargo to authenticated;
grant all on public.descricoes_cargo to service_role;
alter table public.descricoes_cargo enable row level security;

create policy "DC: owner read" on public.descricoes_cargo for select to authenticated using (auth.uid() = user_id);
create policy "DC: owner insert" on public.descricoes_cargo for insert to authenticated with check (auth.uid() = user_id);
create policy "DC: owner update" on public.descricoes_cargo for update to authenticated using (auth.uid() = user_id);
create policy "DC: owner delete" on public.descricoes_cargo for delete to authenticated using (auth.uid() = user_id);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger descricoes_cargo_updated
  before update on public.descricoes_cargo
  for each row execute function public.set_updated_at();

create index descricoes_cargo_user_idx on public.descricoes_cargo(user_id, updated_at desc);
