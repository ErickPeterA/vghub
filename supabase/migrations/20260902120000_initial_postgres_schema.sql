-- Initial PostgreSQL 17 baseline for the people-management system.
-- This migration is intended for a new empty PostgreSQL database.
-- Legacy platform roles, grants, schemas and RLS policies were intentionally
-- not copied. Authorization must be enforced later by the application API.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.project_role AS ENUM (
  'admin',
  'lider_estrategico',
  'lider_tatico',
  'lider_operacional',
  'gp',
  'lider_superior',
  'lider_setor',
  'usuario_comum'
);
CREATE TYPE public.user_status AS ENUM ('ativo', 'inativo');
CREATE TYPE public.project_status AS ENUM ('ativo', 'desativado');
CREATE TYPE public.dynamic_field_type AS ENUM (
  'text',
  'textarea',
  'number',
  'date',
  'checkbox',
  'single_select',
  'multi_select',
  'competency_description'
);
CREATE TYPE public.dc_stage AS ENUM ('em_criacao', 'em_aprovacao', 'concluido');
CREATE TYPE public.activity_link_status AS ENUM ('pending', 'answered', 'expired', 'cancelled');
CREATE TYPE public.organization_position_status AS ENUM ('active', 'inactive');
CREATE TYPE public.performance_participant_type AS ENUM ('collaborator', 'leader');
CREATE TYPE public.performance_participant_status AS ENUM ('not_sent', 'sent', 'accessed', 'in_progress', 'answered');
CREATE TYPE public.performance_review_status AS ENUM ('draft', 'waiting_responses', 'ready_for_comparison', 'finalized');
CREATE TYPE public.pam_status AS ENUM ('draft', 'released', 'in_progress', 'completed');
CREATE TYPE public.pam_item_status AS ENUM ('not_started', 'in_progress', 'completed');

CREATE TABLE public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  display_name text,
  status public.user_status NOT NULL DEFAULT 'ativo',
  external_provider text,
  external_subject text,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_email_not_blank CHECK (length(trim(email)) > 0),
  UNIQUE (external_provider, external_subject)
);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  nome text NOT NULL,
  email text NOT NULL UNIQUE,
  status public.user_status NOT NULL DEFAULT 'ativo',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_nome_not_blank CHECK (length(trim(nome)) > 0),
  CONSTRAINT profiles_email_not_blank CHECK (length(trim(email)) > 0)
);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  empresa text,
  status public.project_status NOT NULL DEFAULT 'ativo',
  responsavel_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT projects_nome_not_blank CHECK (length(trim(nome)) > 0)
);

CREATE TABLE public.project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role public.project_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id),
  CONSTRAINT project_members_user_id_profiles_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);

CREATE TABLE public.project_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  nome text NOT NULL,
  tipo text NOT NULL DEFAULT 'geral',
  descricao text,
  conteudo jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.project_hub (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  secao text NOT NULL DEFAULT 'nota',
  titulo text NOT NULL,
  conteudo text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.project_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  acao text NOT NULL,
  entidade text,
  entidade_id uuid,
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_history_user_id_profiles_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE TABLE public.project_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  etapa text NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  percentual integer NOT NULL DEFAULT 0,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.project_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.project_areas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  cor text,
  display_order integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_areas_nome_not_blank CHECK (length(trim(nome)) > 0)
);

CREATE TABLE public.project_member_scopes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.project_members(id) ON DELETE CASCADE,
  area_id uuid REFERENCES public.project_areas(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.base_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  source_field_id uuid REFERENCES public.base_fields(id) ON DELETE SET NULL,
  field_key text NOT NULL,
  label text NOT NULL,
  section text NOT NULL DEFAULT 'Geral',
  field_type public.dynamic_field_type NOT NULL DEFAULT 'text',
  is_required boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  allows_multiple boolean NOT NULL DEFAULT false,
  allows_free_text boolean NOT NULL DEFAULT false,
  data_source text NOT NULL DEFAULT 'manual',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT base_fields_key_not_blank CHECK (length(trim(field_key)) > 0),
  CONSTRAINT base_fields_label_not_blank CHECK (length(trim(label)) > 0),
  CONSTRAINT base_fields_data_source_check CHECK (data_source IN ('manual', 'areas', 'setores'))
);

CREATE TABLE public.base_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id uuid NOT NULL REFERENCES public.base_fields(id) ON DELETE CASCADE,
  source_option_id uuid REFERENCES public.base_options(id) ON DELETE SET NULL,
  label text NOT NULL,
  value text NOT NULL,
  description text,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (field_id, value)
);

CREATE TABLE public.base_section_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  section text NOT NULL,
  max_items integer NOT NULL DEFAULT 3,
  is_enabled boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT base_section_settings_max_items_check CHECK (max_items >= 1)
);

CREATE TABLE public.project_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.project_positions(id) ON DELETE SET NULL,
  nome text NOT NULL,
  descricao text,
  display_order integer NOT NULL DEFAULT 0,
  status public.organization_position_status NOT NULL DEFAULT 'active',
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_positions_nome_not_blank CHECK (length(trim(nome)) > 0)
);

CREATE TABLE public.descricoes_cargo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  cargo text NOT NULL,
  unidade_negocio text,
  departamento text,
  nivelamento text,
  superior_imediato text,
  tipo_carreira text,
  data_versao date,
  data_revisao date,
  status text NOT NULL DEFAULT 'rascunho',
  objetivo text,
  instrucao jsonb NOT NULL DEFAULT '[]'::jsonb,
  experiencia jsonb NOT NULL DEFAULT '[]'::jsonb,
  conhecimento jsonb NOT NULL DEFAULT '[]'::jsonb,
  atividades jsonb NOT NULL DEFAULT '[]'::jsonb,
  indicadores jsonb NOT NULL DEFAULT '[]'::jsonb,
  habilidades_cargo jsonb NOT NULL DEFAULT '[]'::jsonb,
  habilidades_culturais jsonb NOT NULL DEFAULT '[]'::jsonb,
  postura jsonb NOT NULL DEFAULT '[]'::jsonb,
  dynamic_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  etapa public.dc_stage NOT NULL DEFAULT 'em_criacao',
  organization_position_id uuid REFERENCES public.project_positions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT descricoes_cargo_cargo_not_blank CHECK (length(trim(cargo)) > 0)
);

CREATE TABLE public.job_description_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_description_id uuid NOT NULL REFERENCES public.descricoes_cargo(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  source_comment_version_id uuid REFERENCES public.job_description_versions(id) ON DELETE SET NULL,
  UNIQUE (job_description_id, version_number)
);

CREATE TABLE public.field_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_description_id uuid NOT NULL REFERENCES public.descricoes_cargo(id) ON DELETE CASCADE,
  version_id uuid REFERENCES public.job_description_versions(id) ON DELETE SET NULL,
  field_key text NOT NULL,
  author_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  decision text NOT NULL DEFAULT 'pending',
  decided_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  decided_at timestamptz,
  approved_version_id uuid REFERENCES public.job_description_versions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT field_comments_content_not_blank CHECK (length(trim(content)) > 0),
  CONSTRAINT field_comments_decision_check CHECK (decision IN ('pending', 'approved', 'rejected'))
);

CREATE TABLE public.activity_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  header_schema jsonb NOT NULL DEFAULT '[]'::jsonb,
  questions_schema jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id)
);

CREATE TABLE public.activity_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  config_id uuid NOT NULL REFERENCES public.activity_configs(id) ON DELETE CASCADE,
  token uuid NOT NULL DEFAULT gen_random_uuid(),
  status public.activity_link_status NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL,
  answered_at timestamptz,
  reviewed_at timestamptz,
  label text,
  header_answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  draft_header_answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  draft_question_answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  draft_saved_at timestamptz,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (token)
);

CREATE TABLE public.activity_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES public.activity_links(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  header_answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  question_answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  submitted_ip text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.project_employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  position_id uuid NOT NULL REFERENCES public.project_positions(id) ON DELETE RESTRICT,
  area_id uuid REFERENCES public.project_areas(id) ON DELETE SET NULL,
  sector_id uuid REFERENCES public.project_areas(id) ON DELETE SET NULL,
  superior_imediato_id uuid REFERENCES public.project_employees(id) ON DELETE SET NULL,
  nome text NOT NULL,
  admission_date date NOT NULL,
  last_performance_review_date date,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_employees_nome_not_blank CHECK (length(trim(nome)) > 0),
  CONSTRAINT project_employees_review_after_admission CHECK (
    last_performance_review_date IS NULL
    OR last_performance_review_date >= admission_date
  )
);

CREATE TABLE public.performance_review_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Novo periodo',
  period_days integer NOT NULL DEFAULT 30,
  review_type text NOT NULL DEFAULT 'experience',
  questions_schema jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT performance_review_configs_name_not_blank CHECK (length(trim(name)) > 0),
  CONSTRAINT performance_review_configs_period_days_positive CHECK (period_days > 0),
  CONSTRAINT performance_review_configs_review_type_check CHECK (review_type IN ('experience', 'performance'))
);

CREATE TABLE public.performance_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  config_id uuid REFERENCES public.performance_review_configs(id) ON DELETE SET NULL,
  name text NOT NULL,
  employee_position_id uuid NOT NULL REFERENCES public.project_positions(id) ON DELETE RESTRICT,
  leader_position_id uuid NOT NULL REFERENCES public.project_positions(id) ON DELETE RESTRICT,
  job_description_id uuid NOT NULL REFERENCES public.descricoes_cargo(id) ON DELETE RESTRICT,
  employee_id uuid REFERENCES public.project_employees(id) ON DELETE SET NULL,
  employee_name text NOT NULL,
  leader_name text NOT NULL,
  job_title text NOT NULL,
  job_description_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  activities_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  questions_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  evaluation_weights_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  criterion_scoring_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  score_summary_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  management_opinion text,
  review_type text NOT NULL DEFAULT 'experience',
  period_name text,
  period_days integer,
  due_date date,
  status public.performance_review_status NOT NULL DEFAULT 'waiting_responses',
  finalized_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  finalized_at timestamptz,
  reopened_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  reopened_at timestamptz,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT performance_reviews_name_not_blank CHECK (length(trim(name)) > 0),
  CONSTRAINT performance_reviews_review_type_check CHECK (review_type IN ('experience', 'performance'))
);

CREATE TABLE public.performance_review_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.performance_reviews(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  participant_type public.performance_participant_type NOT NULL,
  token uuid NOT NULL DEFAULT gen_random_uuid(),
  status public.performance_participant_status NOT NULL DEFAULT 'not_sent',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  draft_answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  response_answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  draft_saved_at timestamptz,
  accessed_at timestamptz,
  sent_at timestamptz,
  submitted_at timestamptz,
  submitted_ip text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (review_id, participant_type),
  UNIQUE (token)
);

CREATE TABLE public.performance_review_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.performance_reviews(id) ON DELETE CASCADE,
  question_key text NOT NULL,
  author_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT performance_review_comments_content_not_blank CHECK (length(trim(content)) > 0)
);

CREATE TABLE public.performance_answer_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL REFERENCES public.performance_review_participants(id) ON DELETE CASCADE,
  review_id uuid NOT NULL REFERENCES public.performance_reviews(id) ON DELETE CASCADE,
  question_key text NOT NULL,
  previous_answer text,
  new_answer text,
  changed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.evaluation_weight_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  career_key text NOT NULL,
  career_label text NOT NULL,
  weights jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT evaluation_weight_configs_career_key_not_blank CHECK (length(trim(career_key)) > 0),
  CONSTRAINT evaluation_weight_configs_career_label_not_blank CHECK (length(trim(career_label)) > 0),
  UNIQUE (project_id, career_key)
);

CREATE TABLE public.criterion_scoring_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  criterion_key text NOT NULL,
  scoring_schema jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT criterion_scoring_configs_key_not_blank CHECK (length(trim(criterion_key)) > 0),
  UNIQUE (project_id, criterion_key)
);

CREATE TABLE public.pam (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES public.project_employees(id) ON DELETE SET NULL,
  review_id uuid REFERENCES public.performance_reviews(id) ON DELETE SET NULL,
  token text NOT NULL DEFAULT (
    replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
  ),
  employee_name text NOT NULL,
  job_title text,
  feedback_date date,
  status public.pam_status NOT NULL DEFAULT 'draft',
  released_at timestamptz,
  first_accessed_at timestamptz,
  completed_at timestamptz,
  link_revoked_at timestamptz,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pam_employee_name_not_blank CHECK (length(trim(employee_name)) > 0),
  CONSTRAINT pam_token_not_blank CHECK (length(trim(token)) >= 32),
  UNIQUE (token),
  UNIQUE (review_id)
);

CREATE TABLE public.pam_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pam_id uuid NOT NULL REFERENCES public.pam(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'manual',
  source_key text,
  source_score numeric,
  improvement_point text NOT NULL,
  skill_label text,
  problem_reason text NOT NULL DEFAULT '',
  improvement_plan text NOT NULL DEFAULT '',
  evidence_plan text NOT NULL DEFAULT '',
  review_date date,
  status public.pam_item_status NOT NULL DEFAULT 'not_started',
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pam_items_improvement_point_not_blank CHECK (length(trim(improvement_point)) > 0)
);

CREATE UNIQUE INDEX base_fields_general_key_unique ON public.base_fields(field_key) WHERE project_id IS NULL;
CREATE UNIQUE INDEX base_fields_project_key_unique ON public.base_fields(project_id, field_key) WHERE project_id IS NOT NULL;
CREATE INDEX base_fields_project_order_idx ON public.base_fields(project_id, display_order);
CREATE INDEX base_options_field_order_idx ON public.base_options(field_id, display_order);
CREATE UNIQUE INDEX base_section_settings_general_unique ON public.base_section_settings(section) WHERE project_id IS NULL;
CREATE UNIQUE INDEX base_section_settings_project_unique ON public.base_section_settings(project_id, section) WHERE project_id IS NOT NULL;
CREATE INDEX project_areas_project_idx ON public.project_areas(project_id);
CREATE INDEX project_areas_parent_idx ON public.project_areas(parent_id);
CREATE UNIQUE INDEX project_member_scopes_unique ON public.project_member_scopes(member_id, area_id);
CREATE INDEX project_positions_project_idx ON public.project_positions(project_id);
CREATE INDEX project_positions_parent_idx ON public.project_positions(parent_id);
CREATE INDEX project_positions_project_parent_idx ON public.project_positions(project_id, parent_id);
CREATE UNIQUE INDEX descricoes_cargo_org_position_unique ON public.descricoes_cargo(organization_position_id)
  WHERE organization_position_id IS NOT NULL;
CREATE INDEX descricoes_cargo_org_position_idx ON public.descricoes_cargo(project_id, organization_position_id);
CREATE INDEX idx_field_comments_dc_field ON public.field_comments(job_description_id, field_key);
CREATE INDEX idx_field_comments_version ON public.field_comments(version_id);
CREATE UNIQUE INDEX idx_job_description_versions_source_comment_version
  ON public.job_description_versions(job_description_id, source_comment_version_id)
  WHERE source_comment_version_id IS NOT NULL;
CREATE INDEX idx_activity_links_project ON public.activity_links(project_id);
CREATE INDEX idx_activity_links_status ON public.activity_links(project_id, status);
CREATE INDEX idx_activity_responses_link ON public.activity_responses(link_id);
CREATE INDEX idx_activity_responses_project ON public.activity_responses(project_id);
CREATE INDEX project_employees_project_idx ON public.project_employees(project_id, nome);
CREATE INDEX project_employees_position_idx ON public.project_employees(project_id, position_id);
CREATE INDEX project_employees_area_sector_idx ON public.project_employees(project_id, area_id, sector_id);
CREATE INDEX project_employees_superior_idx ON public.project_employees(project_id, superior_imediato_id);
CREATE UNIQUE INDEX performance_review_configs_project_active_type_unique
  ON public.performance_review_configs(project_id, review_type)
  WHERE project_id IS NOT NULL AND is_active = true;
CREATE UNIQUE INDEX performance_review_configs_general_active_type_unique
  ON public.performance_review_configs(review_type)
  WHERE project_id IS NULL AND is_active = true;
CREATE INDEX performance_review_configs_project_order_idx ON public.performance_review_configs(project_id, period_days);
CREATE INDEX performance_review_configs_project_type_order_idx ON public.performance_review_configs(project_id, review_type, period_days);
CREATE INDEX idx_performance_reviews_project ON public.performance_reviews(project_id, status);
CREATE INDEX idx_performance_reviews_job_description ON public.performance_reviews(project_id, job_description_id);
CREATE INDEX performance_reviews_due_date_idx ON public.performance_reviews(project_id, due_date);
CREATE INDEX performance_reviews_employee_idx ON public.performance_reviews(project_id, employee_id);
CREATE INDEX performance_reviews_review_type_idx ON public.performance_reviews(project_id, review_type);
CREATE INDEX idx_performance_participants_review ON public.performance_review_participants(review_id);
CREATE INDEX idx_performance_comments_review_question ON public.performance_review_comments(review_id, question_key);
CREATE INDEX idx_performance_history_review_question ON public.performance_answer_history(review_id, question_key);
CREATE INDEX evaluation_weight_configs_project_idx ON public.evaluation_weight_configs(project_id);
CREATE INDEX criterion_scoring_configs_project_idx ON public.criterion_scoring_configs(project_id);
CREATE INDEX idx_pam_project_status ON public.pam(project_id, status);
CREATE INDEX idx_pam_review ON public.pam(review_id);
CREATE INDEX idx_pam_token ON public.pam(token);
CREATE INDEX idx_pam_items_pam_order ON public.pam_items(pam_id, display_order);
CREATE UNIQUE INDEX idx_pam_items_unique_source ON public.pam_items(pam_id, source, source_key)
  WHERE source_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.current_app_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email, status)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(trim(NEW.display_name), ''), split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.status
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      status = EXCLUDED.status,
      nome = COALESCE(NULLIF(trim(public.profiles.nome), ''), EXCLUDED.nome),
      updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin'::public.app_role);
$$;

CREATE OR REPLACE FUNCTION public.is_any_gp(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin(_user_id)
    OR EXISTS (
      SELECT 1
      FROM public.project_members member
      WHERE member.user_id = _user_id
        AND member.role = 'gp'::public.project_role
    );
$$;

CREATE OR REPLACE FUNCTION public.is_project_member(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_members pm
    JOIN public.projects p ON p.id = pm.project_id
    WHERE pm.user_id = _user_id
      AND pm.project_id = _project_id
      AND (
        p.status <> 'desativado'::public.project_status
        OR pm.role = 'gp'::public.project_role
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.get_project_role(_user_id uuid, _project_id uuid)
RETURNS public.project_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.project_members
  WHERE user_id = _user_id AND project_id = _project_id
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.can_manage_project_base(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  proj record;
BEGIN
  IF public.is_admin(_user_id) THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = _project_id AND pm.user_id = _user_id AND pm.role = 'gp'::public.project_role
  ) THEN
    RETURN true;
  END IF;

  SELECT * INTO proj FROM public.projects p WHERE p.id = _project_id;
  IF proj IS NULL OR proj.status = 'desativado'::public.project_status THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.projects p WHERE p.id = _project_id AND p.responsavel_id = _user_id
  )
  OR public.get_project_role(_user_id, _project_id) IN ('admin'::public.project_role, 'lider_estrategico'::public.project_role);
END;
$$;

CREATE OR REPLACE FUNCTION public.area_ancestors(_area_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE chain AS (
    SELECT id, parent_id FROM public.project_areas WHERE id = _area_id
    UNION ALL
    SELECT a.id, a.parent_id
    FROM public.project_areas a
    JOIN chain c ON a.id = c.parent_id
  )
  SELECT id FROM chain;
$$;

CREATE OR REPLACE FUNCTION public.can_create_dc(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL
    AND _project_id IS NOT NULL
    AND (
      public.is_admin(_user_id)
      OR EXISTS (
        SELECT 1
        FROM public.projects p
        WHERE p.id = _project_id
          AND (p.created_by = _user_id OR p.responsavel_id = _user_id)
      )
      OR EXISTS (
        SELECT 1
        FROM public.project_members pm
        WHERE pm.project_id = _project_id
          AND pm.user_id = _user_id
          AND pm.role IN (
            'admin'::public.project_role,
            'gp'::public.project_role,
            'usuario_comum'::public.project_role,
            'lider_superior'::public.project_role,
            'lider_setor'::public.project_role,
            'lider_estrategico'::public.project_role,
            'lider_tatico'::public.project_role,
            'lider_operacional'::public.project_role
          )
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.can_view_dc_row(
  _user_id uuid,
  _project_id uuid,
  _created_by uuid,
  _etapa public.dc_stage,
  _departamento text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  member record;
  proj record;
BEGIN
  IF _user_id IS NULL OR _project_id IS NULL THEN
    RETURN false;
  END IF;

  IF public.is_admin(_user_id) THEN
    RETURN true;
  END IF;

  SELECT * INTO proj FROM public.projects p WHERE p.id = _project_id;
  IF proj IS NULL THEN
    RETURN false;
  END IF;

  SELECT * INTO member
  FROM public.project_members
  WHERE project_id = _project_id AND user_id = _user_id
  LIMIT 1;

  IF member IS NOT NULL AND member.role::text = 'gp' THEN
    RETURN true;
  END IF;

  IF proj.status = 'desativado'::public.project_status THEN
    RETURN false;
  END IF;

  IF proj.responsavel_id = _user_id OR proj.created_by = _user_id THEN
    RETURN true;
  END IF;

  IF member IS NULL THEN
    RETURN false;
  END IF;

  IF member.role::text = 'admin' THEN
    RETURN true;
  END IF;

  IF member.role::text = 'usuario_comum' THEN
    RETURN _created_by = _user_id;
  END IF;

  IF member.role::text IN ('lider_superior', 'lider_estrategico', 'lider_tatico', 'lider_operacional') THEN
    RETURN true;
  END IF;

  IF member.role::text = 'lider_setor' THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_manage_dc_row(
  _user_id uuid,
  _project_id uuid,
  _created_by uuid,
  _etapa public.dc_stage,
  _departamento text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  member record;
  proj record;
BEGIN
  IF _user_id IS NULL OR _project_id IS NULL THEN
    RETURN false;
  END IF;

  IF public.is_admin(_user_id) THEN
    RETURN true;
  END IF;

  SELECT * INTO proj FROM public.projects p WHERE p.id = _project_id;
  IF proj IS NULL THEN
    RETURN false;
  END IF;

  SELECT * INTO member
  FROM public.project_members
  WHERE project_id = _project_id AND user_id = _user_id
  LIMIT 1;

  IF member IS NOT NULL AND member.role::text = 'gp' THEN
    RETURN true;
  END IF;

  IF proj.status = 'desativado'::public.project_status THEN
    RETURN false;
  END IF;

  IF proj.responsavel_id = _user_id OR proj.created_by = _user_id THEN
    RETURN true;
  END IF;

  IF member IS NULL THEN
    RETURN false;
  END IF;

  IF member.role::text = 'admin' THEN
    RETURN true;
  END IF;

  IF _created_by = _user_id AND _etapa::text = 'em_criacao' THEN
    RETURN true;
  END IF;

  IF member.role::text = 'usuario_comum' THEN
    RETURN _created_by = _user_id;
  END IF;

  IF member.role::text IN ('lider_superior', 'lider_estrategico', 'lider_tatico', 'lider_operacional', 'lider_setor') THEN
    RETURN _etapa::text IN ('em_aprovacao', 'concluido');
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_view_dc(_user_id uuid, _dc_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  dc record;
BEGIN
  SELECT project_id, created_by, etapa, departamento
  INTO dc
  FROM public.descricoes_cargo
  WHERE id = _dc_id;

  IF dc IS NULL THEN
    RETURN false;
  END IF;

  RETURN public.can_view_dc_row(_user_id, dc.project_id, dc.created_by, dc.etapa, dc.departamento);
END;
$$;

CREATE OR REPLACE FUNCTION public.can_delete_dc(_user_id uuid, _project_id uuid, _created_by uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  proj record;
BEGIN
  IF public.is_admin(_user_id) THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = _project_id AND pm.user_id = _user_id AND pm.role = 'gp'::public.project_role
  ) THEN
    RETURN true;
  END IF;

  SELECT * INTO proj FROM public.projects p WHERE p.id = _project_id;
  IF proj IS NULL OR proj.status = 'desativado'::public.project_status THEN
    RETURN false;
  END IF;

  RETURN proj.responsavel_id = _user_id OR _created_by = _user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_dc_stage_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_id uuid := public.current_app_user_id();
BEGIN
  IF actor_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = actor_id) THEN
    actor_id := NULL;
  END IF;

  IF NEW.etapa IS DISTINCT FROM OLD.etapa THEN
    INSERT INTO public.project_history(project_id, user_id, acao, entidade, entidade_id, detalhes)
    VALUES (NEW.project_id, actor_id, 'dc_etapa_alterada', 'descricao_cargo', NEW.id,
            jsonb_build_object('de', OLD.etapa, 'para', NEW.etapa));
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.project_position_is_descendant(_ancestor_id uuid, _candidate_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE descendants AS (
    SELECT id FROM public.project_positions WHERE parent_id = _ancestor_id
    UNION ALL
    SELECT p.id
    FROM public.project_positions p
    JOIN descendants d ON p.parent_id = d.id
  )
  SELECT EXISTS (SELECT 1 FROM descendants WHERE id = _candidate_id);
$$;

CREATE OR REPLACE FUNCTION public.validate_project_position_parent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  parent_project uuid;
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.parent_id = NEW.id THEN
    RAISE EXCEPTION 'Um cargo nao pode ser superior dele mesmo.';
  END IF;

  SELECT project_id INTO parent_project FROM public.project_positions WHERE id = NEW.parent_id;
  IF parent_project IS NULL OR parent_project <> NEW.project_id THEN
    RAISE EXCEPTION 'O superior imediato precisa pertencer ao mesmo projeto.';
  END IF;

  IF TG_OP = 'UPDATE' AND public.project_position_is_descendant(NEW.id, NEW.parent_id) THEN
    RAISE EXCEPTION 'Nao e permitido criar ciclo na hierarquia.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.move_project_position(_position_id uuid, _new_parent_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_project uuid;
  next_order integer;
  actor_id uuid := public.current_app_user_id();
BEGIN
  SELECT project_id INTO current_project FROM public.project_positions WHERE id = _position_id;
  IF current_project IS NULL THEN
    RAISE EXCEPTION 'Cargo nao encontrado.';
  END IF;
  IF NOT public.can_manage_project_base(actor_id, current_project) THEN
    RAISE EXCEPTION 'Sem permissao para alterar este organograma.';
  END IF;
  IF _new_parent_id = _position_id THEN
    RAISE EXCEPTION 'Um cargo nao pode ser superior dele mesmo.';
  END IF;
  IF _new_parent_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.project_positions WHERE id = _new_parent_id AND project_id = current_project) THEN
      RAISE EXCEPTION 'Superior imediato invalido.';
    END IF;
    IF public.project_position_is_descendant(_position_id, _new_parent_id) THEN
      RAISE EXCEPTION 'Nao e permitido mover um cargo para baixo de um subordinado.';
    END IF;
  END IF;

  SELECT COALESCE(MAX(display_order), 0) + 10 INTO next_order
  FROM public.project_positions
  WHERE project_id = current_project AND parent_id IS NOT DISTINCT FROM _new_parent_id;

  UPDATE public.project_positions
  SET parent_id = _new_parent_id, display_order = next_order
  WHERE id = _position_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.insert_project_position_above(
  _target_id uuid,
  _nome text,
  _descricao text DEFAULT NULL,
  _status public.organization_position_status DEFAULT 'active'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_row public.project_positions%ROWTYPE;
  new_id uuid;
  actor_id uuid := public.current_app_user_id();
BEGIN
  SELECT * INTO target_row FROM public.project_positions WHERE id = _target_id;
  IF target_row.id IS NULL THEN
    RAISE EXCEPTION 'Cargo nao encontrado.';
  END IF;
  IF NOT public.can_manage_project_base(actor_id, target_row.project_id) THEN
    RAISE EXCEPTION 'Sem permissao para alterar este organograma.';
  END IF;
  IF length(trim(COALESCE(_nome, ''))) = 0 THEN
    RAISE EXCEPTION 'Nome do cargo e obrigatorio.';
  END IF;

  INSERT INTO public.project_positions(project_id, parent_id, nome, descricao, display_order, status, created_by)
  VALUES (target_row.project_id, target_row.parent_id, trim(_nome), NULLIF(trim(COALESCE(_descricao, '')), ''), target_row.display_order, _status, actor_id)
  RETURNING id INTO new_id;

  UPDATE public.project_positions
  SET parent_id = new_id, display_order = 10
  WHERE id = target_row.id;

  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_project_position_with_reassignment(_position_id uuid, _children_parent_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_row public.project_positions%ROWTYPE;
  child record;
  next_order integer;
  actor_id uuid := public.current_app_user_id();
BEGIN
  SELECT * INTO target_row FROM public.project_positions WHERE id = _position_id;
  IF target_row.id IS NULL THEN
    RAISE EXCEPTION 'Cargo nao encontrado.';
  END IF;
  IF NOT public.can_manage_project_base(actor_id, target_row.project_id) THEN
    RAISE EXCEPTION 'Sem permissao para excluir este cargo.';
  END IF;
  IF _children_parent_id = _position_id THEN
    RAISE EXCEPTION 'Destino invalido para subordinados.';
  END IF;
  IF _children_parent_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.project_positions WHERE id = _children_parent_id AND project_id = target_row.project_id
  ) THEN
    RAISE EXCEPTION 'Superior escolhido invalido.';
  END IF;
  IF _children_parent_id IS NOT NULL AND public.project_position_is_descendant(_position_id, _children_parent_id) THEN
    RAISE EXCEPTION 'Nao e permitido repassar subordinados para dentro da propria estrutura excluida.';
  END IF;

  SELECT COALESCE(MAX(display_order), 0) INTO next_order
  FROM public.project_positions
  WHERE project_id = target_row.project_id AND parent_id IS NOT DISTINCT FROM _children_parent_id;

  FOR child IN SELECT id FROM public.project_positions WHERE parent_id = _position_id ORDER BY display_order, created_at LOOP
    next_order := next_order + 10;
    UPDATE public.project_positions SET parent_id = _children_parent_id, display_order = next_order WHERE id = child.id;
  END LOOP;

  DELETE FROM public.project_positions WHERE id = _position_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reorder_project_position(_position_id uuid, _direction text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_row public.project_positions%ROWTYPE;
  swap_row public.project_positions%ROWTYPE;
  actor_id uuid := public.current_app_user_id();
BEGIN
  SELECT * INTO current_row FROM public.project_positions WHERE id = _position_id;
  IF current_row.id IS NULL THEN
    RAISE EXCEPTION 'Cargo nao encontrado.';
  END IF;
  IF NOT public.can_manage_project_base(actor_id, current_row.project_id) THEN
    RAISE EXCEPTION 'Sem permissao para reordenar este organograma.';
  END IF;

  IF _direction = 'up' THEN
    SELECT * INTO swap_row
    FROM public.project_positions
    WHERE project_id = current_row.project_id
      AND parent_id IS NOT DISTINCT FROM current_row.parent_id
      AND (display_order, created_at, id) < (current_row.display_order, current_row.created_at, current_row.id)
    ORDER BY display_order DESC, created_at DESC, id DESC
    LIMIT 1;
  ELSIF _direction = 'down' THEN
    SELECT * INTO swap_row
    FROM public.project_positions
    WHERE project_id = current_row.project_id
      AND parent_id IS NOT DISTINCT FROM current_row.parent_id
      AND (display_order, created_at, id) > (current_row.display_order, current_row.created_at, current_row.id)
    ORDER BY display_order ASC, created_at ASC, id ASC
    LIMIT 1;
  ELSE
    RAISE EXCEPTION 'Direcao invalida.';
  END IF;

  IF swap_row.id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.project_positions SET display_order = swap_row.display_order WHERE id = current_row.id;
  UPDATE public.project_positions SET display_order = current_row.display_order WHERE id = swap_row.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_project_employee_links()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  linked_project uuid;
  linked_parent uuid;
  has_cycle boolean;
BEGIN
  SELECT project_id INTO linked_project
  FROM public.project_positions
  WHERE id = NEW.position_id;

  IF linked_project IS NULL OR linked_project <> NEW.project_id THEN
    RAISE EXCEPTION 'O cargo precisa pertencer ao mesmo projeto.';
  END IF;

  IF NEW.area_id IS NOT NULL THEN
    SELECT project_id, parent_id INTO linked_project, linked_parent
    FROM public.project_areas
    WHERE id = NEW.area_id;

    IF linked_project IS NULL OR linked_project <> NEW.project_id OR linked_parent IS NOT NULL THEN
      RAISE EXCEPTION 'A area precisa pertencer ao mesmo projeto.';
    END IF;
  END IF;

  IF NEW.sector_id IS NOT NULL THEN
    IF NEW.area_id IS NULL THEN
      RAISE EXCEPTION 'Selecione uma area antes do setor.';
    END IF;

    SELECT project_id, parent_id INTO linked_project, linked_parent
    FROM public.project_areas
    WHERE id = NEW.sector_id;

    IF linked_project IS NULL OR linked_project <> NEW.project_id THEN
      RAISE EXCEPTION 'O setor precisa pertencer ao mesmo projeto.';
    END IF;

    IF linked_parent <> NEW.area_id THEN
      RAISE EXCEPTION 'O setor precisa pertencer a area selecionada.';
    END IF;
  END IF;

  IF NEW.superior_imediato_id IS NOT NULL THEN
    IF NEW.superior_imediato_id = NEW.id THEN
      RAISE EXCEPTION 'Um funcionario nao pode responder para ele mesmo.';
    END IF;

    SELECT project_id INTO linked_project
    FROM public.project_employees
    WHERE id = NEW.superior_imediato_id;

    IF linked_project IS NULL OR linked_project <> NEW.project_id THEN
      RAISE EXCEPTION 'O superior imediato precisa pertencer ao mesmo projeto.';
    END IF;

    WITH RECURSIVE hierarchy AS (
      SELECT id, superior_imediato_id
      FROM public.project_employees
      WHERE id = NEW.superior_imediato_id
      UNION ALL
      SELECT employee.id, employee.superior_imediato_id
      FROM public.project_employees employee
      JOIN hierarchy parent ON employee.id = parent.superior_imediato_id
    )
    SELECT EXISTS (SELECT 1 FROM hierarchy WHERE id = NEW.id)
    INTO has_cycle;

    IF has_cycle THEN
      RAISE EXCEPTION 'A hierarquia de funcionarios nao pode formar um ciclo.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_dc_version_snapshot(_dc_id uuid, _created_by uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_num integer;
  snap jsonb;
  new_id uuid;
BEGIN
  SELECT COALESCE(MAX(version_number), 0) + 1 INTO next_num
  FROM public.job_description_versions
  WHERE job_description_id = _dc_id;

  SELECT to_jsonb(d) INTO snap FROM public.descricoes_cargo d WHERE d.id = _dc_id;
  IF snap IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.job_description_versions (job_description_id, version_number, snapshot, created_by)
  VALUES (_dc_id, next_num, snap, _created_by)
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.dc_snapshot_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.create_dc_version_snapshot(NEW.id, NEW.created_by);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.decide_field_comment(_comment_id uuid, _decision text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  comment_row public.field_comments%ROWTYPE;
  actor_id uuid := public.current_app_user_id();
BEGIN
  IF _decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Decisao invalida.';
  END IF;

  SELECT * INTO comment_row
  FROM public.field_comments
  WHERE id = _comment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Comentario nao encontrado.';
  END IF;

  IF NOT public.can_view_dc(actor_id, comment_row.job_description_id) THEN
    RAISE EXCEPTION 'Sem permissao para avaliar este comentario.';
  END IF;

  UPDATE public.field_comments
  SET decision = _decision,
      decided_by = actor_id,
      decided_at = now(),
      approved_version_id = NULL
  WHERE id = _comment_id;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_resolved_dc_comments(_dc_id uuid, _version_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_num integer;
  snap jsonb;
  target_version_id uuid;
  actor_id uuid := public.current_app_user_id();
BEGIN
  IF NOT public.can_view_dc(actor_id, _dc_id) THEN
    RAISE EXCEPTION 'Sem permissao para finalizar comentarios desta descricao.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.field_comments
    WHERE job_description_id = _dc_id
      AND version_id = _version_id
  ) THEN
    RETURN NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.field_comments
    WHERE job_description_id = _dc_id
      AND version_id = _version_id
      AND decision = 'pending'
  ) THEN
    RETURN NULL;
  END IF;

  SELECT id INTO target_version_id
  FROM public.job_description_versions
  WHERE job_description_id = _dc_id
    AND source_comment_version_id = _version_id
  LIMIT 1;

  IF target_version_id IS NOT NULL THEN
    RETURN target_version_id;
  END IF;

  SELECT COALESCE(MAX(version_number), 0) + 1 INTO next_num
  FROM public.job_description_versions
  WHERE job_description_id = _dc_id;

  SELECT to_jsonb(d) INTO snap
  FROM public.descricoes_cargo d
  WHERE d.id = _dc_id;

  IF snap IS NULL THEN
    RAISE EXCEPTION 'Descricao nao encontrada.';
  END IF;

  INSERT INTO public.job_description_versions (
    job_description_id,
    version_number,
    snapshot,
    created_by,
    source_comment_version_id
  )
  VALUES (
    _dc_id,
    next_num,
    snap,
    actor_id,
    _version_id
  )
  RETURNING id INTO target_version_id;

  UPDATE public.field_comments
  SET approved_version_id = target_version_id
  WHERE job_description_id = _dc_id
    AND version_id = _version_id
    AND decision = 'approved';

  RETURN target_version_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reopen_dc_on_leader_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.decision = 'pending'
     AND EXISTS (
       SELECT 1
       FROM public.project_members pm
       JOIN public.descricoes_cargo dc ON dc.project_id = pm.project_id
       WHERE dc.id = NEW.job_description_id
         AND pm.user_id = NEW.author_id
         AND pm.role::text IN (
           'lider_superior',
           'lider_estrategico',
           'lider_tatico',
           'lider_operacional',
           'lider_setor'
         )
     ) THEN
    UPDATE public.descricoes_cargo
    SET etapa = 'em_criacao'::public.dc_stage
    WHERE id = NEW.job_description_id
      AND etapa <> 'em_criacao'::public.dc_stage;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.propagate_general_option_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.source_option_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.base_options (field_id, source_option_id, label, value, description, display_order, is_active)
  SELECT field.id, NEW.id, NEW.label, NEW.value, NEW.description, NEW.display_order, NEW.is_active
  FROM public.base_fields field
  WHERE field.source_field_id = NEW.field_id
    AND NOT EXISTS (
      SELECT 1 FROM public.base_options option
      WHERE option.field_id = field.id
        AND option.source_option_id = NEW.id
    )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.propagate_general_option_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.source_option_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.base_options
  SET label = NEW.label,
      value = NEW.value,
      description = NEW.description,
      display_order = NEW.display_order,
      is_active = NEW.is_active
  WHERE source_option_id = NEW.id;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.propagate_general_field_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.project_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.base_fields
  SET label = NEW.label,
      section = NEW.section,
      field_type = NEW.field_type,
      is_required = NEW.is_required,
      display_order = NEW.display_order,
      allows_multiple = NEW.allows_multiple,
      allows_free_text = NEW.allows_free_text,
      data_source = CASE
        WHEN NEW.field_key = 'nivelamento' THEN 'manual'
        WHEN NEW.field_key IN ('unidade_negocio', 'area') OR lower(NEW.label) = 'area' THEN 'areas'
        WHEN NEW.field_key IN ('departamento', 'setor') OR lower(NEW.label) = 'setor' THEN 'setores'
        ELSE 'manual'
      END,
      is_active = NEW.is_active
  WHERE source_field_id = NEW.id;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.propagate_general_field_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p record;
  new_id uuid;
BEGIN
  IF NEW.project_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  FOR p IN SELECT id, created_by FROM public.projects LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.base_fields
      WHERE project_id = p.id AND (source_field_id = NEW.id OR field_key = NEW.field_key)
    ) THEN
      INSERT INTO public.base_fields (
        project_id, source_field_id, field_key, label, section, field_type,
        is_required, display_order, allows_multiple, allows_free_text, data_source, is_active, created_by
      ) VALUES (
        p.id, NEW.id, NEW.field_key, NEW.label, NEW.section, NEW.field_type,
        NEW.is_required, NEW.display_order, NEW.allows_multiple, NEW.allows_free_text,
        CASE
          WHEN NEW.field_key = 'nivelamento' THEN 'manual'
          WHEN NEW.field_key IN ('unidade_negocio', 'area') OR lower(NEW.label) = 'area' THEN 'areas'
          WHEN NEW.field_key IN ('departamento', 'setor') OR lower(NEW.label) = 'setor' THEN 'setores'
          ELSE 'manual'
        END,
        NEW.is_active, p.created_by
      )
      RETURNING id INTO new_id;

      INSERT INTO public.base_options (field_id, source_option_id, label, value, description, display_order, is_active)
      SELECT new_id, option.id, option.label, option.value, option.description, option.display_order, option.is_active
      FROM public.base_options option
      WHERE option.field_id = NEW.id
      ORDER BY option.display_order, option.created_at;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.propagate_general_section_setting_upsert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p record;
BEGIN
  IF NEW.project_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  FOR p IN SELECT id, created_by FROM public.projects LOOP
    UPDATE public.base_section_settings
    SET max_items = NEW.max_items,
        is_enabled = NEW.is_enabled
    WHERE project_id = p.id
      AND section = NEW.section;

    IF NOT FOUND THEN
      INSERT INTO public.base_section_settings (project_id, section, max_items, is_enabled, created_by)
      VALUES (p.id, NEW.section, NEW.max_items, NEW.is_enabled, p.created_by);
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.propagate_global_performance_config()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.project_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.performance_review_configs(project_id, name, period_days, review_type, questions_schema, is_active, created_by)
  SELECT project.id, NEW.name, NEW.period_days, NEW.review_type, NEW.questions_schema, NEW.is_active, project.created_by
  FROM public.projects project
  WHERE NEW.is_active = true
    AND NOT EXISTS (
      SELECT 1
      FROM public.performance_review_configs cfg
      WHERE cfg.project_id = project.id
        AND cfg.review_type = NEW.review_type
        AND cfg.is_active = true
    );

  UPDATE public.performance_review_configs cfg
  SET name = NEW.name,
      questions_schema = NEW.questions_schema,
      is_active = NEW.is_active
  WHERE cfg.project_id IS NOT NULL
    AND cfg.review_type = NEW.review_type
    AND cfg.is_active = true;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.clone_general_base_to_project(_project_id uuid, _created_by uuid DEFAULT NULL::uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  source_field record;
  new_field_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.base_fields WHERE project_id = _project_id) THEN
    FOR source_field IN
      SELECT * FROM public.base_fields WHERE project_id IS NULL ORDER BY display_order, created_at
    LOOP
      INSERT INTO public.base_fields (
        project_id, source_field_id, field_key, label, section, field_type,
        is_required, display_order, allows_multiple, allows_free_text, data_source, is_active, created_by
      ) VALUES (
        _project_id, source_field.id, source_field.field_key, source_field.label, source_field.section, source_field.field_type,
        source_field.is_required, source_field.display_order, source_field.allows_multiple, source_field.allows_free_text,
        CASE
          WHEN source_field.field_key = 'nivelamento' THEN 'manual'
          WHEN source_field.field_key IN ('unidade_negocio', 'area') OR lower(source_field.label) = 'area' THEN 'areas'
          WHEN source_field.field_key IN ('departamento', 'setor') OR lower(source_field.label) = 'setor' THEN 'setores'
          ELSE 'manual'
        END,
        source_field.is_active, _created_by
      )
      RETURNING id INTO new_field_id;

      INSERT INTO public.base_options (field_id, source_option_id, label, value, description, display_order, is_active)
      SELECT new_field_id, option.id, option.label, option.value, option.description, option.display_order, option.is_active
      FROM public.base_options option
      WHERE option.field_id = source_field.id
      ORDER BY option.display_order, option.created_at;
    END LOOP;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.base_section_settings WHERE project_id = _project_id) THEN
    INSERT INTO public.base_section_settings (project_id, section, max_items, is_enabled, created_by)
    SELECT _project_id, setting.section, setting.max_items, setting.is_enabled, _created_by
    FROM public.base_section_settings setting
    WHERE setting.project_id IS NULL;
  END IF;

  INSERT INTO public.performance_review_configs(project_id, name, period_days, review_type, questions_schema, is_active, created_by)
  SELECT _project_id, template.name, template.period_days, template.review_type, template.questions_schema, template.is_active, _created_by
  FROM public.performance_review_configs template
  WHERE template.project_id IS NULL
    AND template.is_active = true
    AND NOT EXISTS (
      SELECT 1
      FROM public.performance_review_configs cfg
      WHERE cfg.project_id = _project_id
        AND cfg.review_type = template.review_type
        AND cfg.is_active = true
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.clone_base_on_project_create()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.clone_general_base_to_project(NEW.id, NEW.created_by);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_base_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_project_id uuid;
  target_id uuid;
  action_name text;
  actor_id uuid := public.current_app_user_id();
BEGIN
  IF actor_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = actor_id) THEN
    actor_id := NULL;
  END IF;

  IF TG_TABLE_NAME = 'base_fields' THEN
    target_project_id := COALESCE(NEW.project_id, OLD.project_id);
    target_id := COALESCE(NEW.id, OLD.id);
  ELSE
    SELECT project_id INTO target_project_id
    FROM public.base_fields
    WHERE id = COALESCE(NEW.field_id, OLD.field_id);
    target_id := COALESCE(NEW.id, OLD.id);
  END IF;

  IF target_project_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  action_name := CASE TG_OP
    WHEN 'INSERT' THEN 'base_item_criado'
    WHEN 'UPDATE' THEN 'base_item_atualizado'
    ELSE 'base_item_excluido'
  END;

  INSERT INTO public.project_history(project_id, user_id, acao, entidade, entidade_id, detalhes)
  VALUES (target_project_id, actor_id, action_name, TG_TABLE_NAME, target_id, jsonb_build_object('operacao', TG_OP));

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_performance_review_status(_review_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_count integer;
  answered_count integer;
  current_status public.performance_review_status;
BEGIN
  SELECT status INTO current_status FROM public.performance_reviews WHERE id = _review_id;
  IF current_status = 'finalized' THEN
    RETURN;
  END IF;

  SELECT count(*), count(*) FILTER (WHERE status = 'answered')
    INTO total_count, answered_count
  FROM public.performance_review_participants
  WHERE review_id = _review_id;

  UPDATE public.performance_reviews
  SET status = CASE
    WHEN total_count = 2 AND answered_count = 2 THEN 'ready_for_comparison'::public.performance_review_status
    ELSE 'waiting_responses'::public.performance_review_status
  END
  WHERE id = _review_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_refresh_performance_review_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.refresh_performance_review_status(OLD.review_id);
    RETURN OLD;
  END IF;

  PERFORM public.refresh_performance_review_status(NEW.review_id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_pam_from_finalized_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_pam_id uuid;
BEGIN
  IF NEW.status <> 'finalized'::public.performance_review_status THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.review_type, 'experience') <> 'performance' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'finalized'::public.performance_review_status THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.pam (
    project_id,
    employee_id,
    review_id,
    employee_name,
    job_title,
    feedback_date,
    status,
    created_by
  )
  VALUES (
    NEW.project_id,
    NEW.employee_id,
    NEW.id,
    NEW.employee_name,
    NEW.job_title,
    COALESCE(NEW.finalized_at, now())::date,
    'draft'::public.pam_status,
    NEW.finalized_by
  )
  ON CONFLICT (review_id) DO NOTHING
  RETURNING id INTO target_pam_id;

  IF target_pam_id IS NULL THEN
    SELECT id INTO target_pam_id
    FROM public.pam
    WHERE review_id = NEW.id;
  END IF;

  IF target_pam_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.pam_items (
    pam_id,
    source,
    source_key,
    source_score,
    improvement_point,
    skill_label,
    display_order
  )
  SELECT
    target_pam_id,
    'performance_review',
    source_key,
    score,
    label,
    COALESCE(NULLIF(requirement_label, ''), label),
    display_order
  FROM (
    SELECT
      COALESCE(criterion->>'key', criterion->>'label') AS source_key,
      NULLIF(criterion->>'label', '') AS label,
      NULLIF(criterion->>'requirementLabel', '') AS requirement_label,
      (criterion->>'collaboratorAverage')::numeric AS score,
      row_number() OVER () AS display_order
    FROM jsonb_array_elements(COALESCE(NEW.score_summary_snapshot->'criteria', '[]'::jsonb)) AS criterion
    WHERE (criterion->>'collaboratorAverage') ~ '^[0-9]+(\.[0-9]+)?$'
      AND (criterion->>'collaboratorAverage')::numeric < 80
      AND NULLIF(criterion->>'label', '') IS NOT NULL
  ) scored
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_profiles_upd
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_users_profile_sync
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
CREATE TRIGGER trg_projects_upd
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_tpl_upd
  BEFORE UPDATE ON public.project_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_hub_upd
  BEFORE UPDATE ON public.project_hub
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_prog_upd
  BEFORE UPDATE ON public.project_progress
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_project_areas_upd
  BEFORE UPDATE ON public.project_areas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_base_fields_updated_at
  BEFORE UPDATE ON public.base_fields
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_base_options_updated_at
  BEFORE UPDATE ON public.base_options
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_base_section_settings_updated_at
  BEFORE UPDATE ON public.base_section_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_project_positions_upd
  BEFORE UPDATE ON public.project_positions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_dc_upd
  BEFORE UPDATE ON public.descricoes_cargo
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_activity_configs_updated_at
  BEFORE UPDATE ON public.activity_configs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_activity_links_updated_at
  BEFORE UPDATE ON public.activity_links
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_activity_responses_updated_at
  BEFORE UPDATE ON public.activity_responses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_project_employees_upd
  BEFORE UPDATE ON public.project_employees
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_performance_review_configs_updated_at
  BEFORE UPDATE ON public.performance_review_configs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_performance_reviews_updated_at
  BEFORE UPDATE ON public.performance_reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_performance_participants_updated_at
  BEFORE UPDATE ON public.performance_review_participants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_evaluation_weight_configs_updated_at
  BEFORE UPDATE ON public.evaluation_weight_configs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_criterion_scoring_configs_updated_at
  BEFORE UPDATE ON public.criterion_scoring_configs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_pam_updated_at
  BEFORE UPDATE ON public.pam
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_pam_items_updated_at
  BEFORE UPDATE ON public.pam_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER clone_base_after_project_create
  AFTER INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.clone_base_on_project_create();
CREATE TRIGGER log_base_fields_change
  AFTER INSERT OR UPDATE OR DELETE ON public.base_fields
  FOR EACH ROW EXECUTE FUNCTION public.log_base_change();
CREATE TRIGGER log_base_options_change
  AFTER INSERT OR UPDATE OR DELETE ON public.base_options
  FOR EACH ROW EXECUTE FUNCTION public.log_base_change();
CREATE TRIGGER trg_propagate_general_option_insert
  AFTER INSERT ON public.base_options
  FOR EACH ROW EXECUTE FUNCTION public.propagate_general_option_insert();
CREATE TRIGGER trg_propagate_general_option_update
  AFTER UPDATE ON public.base_options
  FOR EACH ROW EXECUTE FUNCTION public.propagate_general_option_update();
CREATE TRIGGER trg_propagate_general_field_update
  AFTER UPDATE ON public.base_fields
  FOR EACH ROW EXECUTE FUNCTION public.propagate_general_field_update();
CREATE TRIGGER trg_propagate_general_field_insert
  AFTER INSERT ON public.base_fields
  FOR EACH ROW EXECUTE FUNCTION public.propagate_general_field_insert();
CREATE TRIGGER trg_propagate_general_section_setting_insert
  AFTER INSERT ON public.base_section_settings
  FOR EACH ROW EXECUTE FUNCTION public.propagate_general_section_setting_upsert();
CREATE TRIGGER trg_propagate_general_section_setting_update
  AFTER UPDATE ON public.base_section_settings
  FOR EACH ROW EXECUTE FUNCTION public.propagate_general_section_setting_upsert();
CREATE TRIGGER trg_project_positions_validate_parent
  BEFORE INSERT OR UPDATE OF parent_id, project_id ON public.project_positions
  FOR EACH ROW EXECUTE FUNCTION public.validate_project_position_parent();
CREATE TRIGGER trg_dc_stage_log
  AFTER UPDATE OF etapa ON public.descricoes_cargo
  FOR EACH ROW EXECUTE FUNCTION public.log_dc_stage_change();
CREATE TRIGGER trg_dc_snapshot_on_insert
  AFTER INSERT ON public.descricoes_cargo
  FOR EACH ROW EXECUTE FUNCTION public.dc_snapshot_on_insert();
CREATE TRIGGER trg_reopen_dc_on_leader_comment
  AFTER INSERT ON public.field_comments
  FOR EACH ROW EXECUTE FUNCTION public.reopen_dc_on_leader_comment();
CREATE TRIGGER trg_project_employees_validate_links
  BEFORE INSERT OR UPDATE OF project_id, position_id, area_id, sector_id, superior_imediato_id ON public.project_employees
  FOR EACH ROW EXECUTE FUNCTION public.validate_project_employee_links();
CREATE TRIGGER trg_propagate_global_performance_config_insert
  AFTER INSERT ON public.performance_review_configs
  FOR EACH ROW
  WHEN (NEW.project_id IS NULL)
  EXECUTE FUNCTION public.propagate_global_performance_config();
CREATE TRIGGER trg_propagate_global_performance_config_update
  AFTER UPDATE OF name, questions_schema, is_active ON public.performance_review_configs
  FOR EACH ROW
  WHEN (NEW.project_id IS NULL)
  EXECUTE FUNCTION public.propagate_global_performance_config();
CREATE TRIGGER trg_performance_participants_refresh_status
  AFTER INSERT OR UPDATE OF status OR DELETE ON public.performance_review_participants
  FOR EACH ROW EXECUTE FUNCTION public.trg_refresh_performance_review_status();
CREATE TRIGGER trg_performance_reviews_create_pam
  AFTER INSERT OR UPDATE OF status ON public.performance_reviews
  FOR EACH ROW EXECUTE FUNCTION public.create_pam_from_finalized_review();

-- Structural seed data: application defaults required for new projects.
WITH seed(field_key, label, section, field_type, is_required, display_order, allows_multiple, allows_free_text, data_source) AS (
  VALUES
    ('cargo', 'Nomenclatura do cargo visivel', 'Cabecalho', 'text'::public.dynamic_field_type, true, 10, false, true, 'manual'),
    ('unidade_negocio', 'Area', 'Cabecalho', 'single_select'::public.dynamic_field_type, false, 20, false, true, 'areas'),
    ('departamento', 'Setor', 'Cabecalho', 'single_select'::public.dynamic_field_type, false, 30, false, true, 'setores'),
    ('nivelamento', 'Nivelamento', 'Cabecalho', 'single_select'::public.dynamic_field_type, false, 40, false, true, 'manual'),
    ('superior_imediato', 'Cargo do superior imediato', 'Cabecalho', 'text'::public.dynamic_field_type, false, 50, false, true, 'manual'),
    ('tipo_carreira', 'Tipo de carreira', 'Cabecalho', 'single_select'::public.dynamic_field_type, false, 60, false, true, 'manual'),
    ('data_versao', 'Data da versao', 'Cabecalho', 'date'::public.dynamic_field_type, false, 70, false, false, 'manual'),
    ('data_revisao', 'Ultima revisao', 'Cabecalho', 'date'::public.dynamic_field_type, false, 80, false, false, 'manual'),
    ('status', 'Status', 'Cabecalho', 'single_select'::public.dynamic_field_type, true, 90, false, false, 'manual'),
    ('objetivo', 'Objetivo do cargo', 'Cabecalho', 'textarea'::public.dynamic_field_type, false, 100, false, true, 'manual'),
    ('escolaridade', 'Escolaridade', 'Instrucao', 'multi_select'::public.dynamic_field_type, false, 110, true, true, 'manual'),
    ('conhecimentos', 'Conhecimentos', 'Conhecimento', 'multi_select'::public.dynamic_field_type, false, 120, true, true, 'manual'),
    ('competencias', 'Competencias', 'Habilidades', 'multi_select'::public.dynamic_field_type, false, 130, true, true, 'manual')
)
INSERT INTO public.base_fields(field_key, label, section, field_type, is_required, display_order, allows_multiple, allows_free_text, data_source)
SELECT * FROM seed;

INSERT INTO public.base_options(field_id, label, value, display_order)
SELECT field.id, option_data.label, option_data.value, option_data.display_order
FROM public.base_fields field
JOIN (VALUES
  ('nivelamento', 'Junior', 'junior', 10),
  ('nivelamento', 'Pleno', 'pleno', 20),
  ('nivelamento', 'Senior', 'senior', 30),
  ('tipo_carreira', 'Especialista', 'especialista', 10),
  ('tipo_carreira', 'Gestao', 'gestao', 20),
  ('status', 'Rascunho', 'rascunho', 10),
  ('status', 'Em revisao', 'em_revisao', 20),
  ('status', 'Aprovado', 'aprovado', 30),
  ('status', 'Arquivado', 'arquivado', 40),
  ('escolaridade', 'Ensino Medio', 'ensino_medio', 10),
  ('escolaridade', 'Superior', 'superior', 20),
  ('escolaridade', 'Pos-graduacao', 'pos_graduacao', 30),
  ('conhecimentos', 'Excel', 'excel', 10),
  ('conhecimentos', 'Power BI', 'power_bi', 20),
  ('competencias', 'Lideranca', 'lideranca', 10),
  ('competencias', 'Comunicacao', 'comunicacao', 20),
  ('competencias', 'Organizacao', 'organizacao', 30)
) AS option_data(field_key, label, value, display_order)
  ON option_data.field_key = field.field_key
WHERE field.project_id IS NULL;

INSERT INTO public.base_section_settings(section, max_items, is_enabled)
VALUES
  ('Instrucao', 3, true),
  ('Experiencia', 3, true),
  ('Conhecimento', 3, true),
  ('Atividades', 5, true),
  ('Indicadores', 5, true),
  ('Habilidades do cargo', 5, true),
  ('Habilidades culturais', 5, true),
  ('Postura', 5, true);

INSERT INTO public.performance_review_configs(name, period_days, review_type, questions_schema, is_active)
VALUES
  (
    'Avaliacao de experiencia',
    30,
    'experience',
    '[
      {"id":"normas_recebeu_informacoes","label":"Ao ingressar na empresa voce recebeu informacoes sobre normas internas?","type":"select","required":true,"active":true,"options":["Sim","Nao"]},
      {"id":"treinamento_recebeu","label":"Voce recebeu treinamento ou orientacao para executar seu trabalho?","type":"select","required":true,"active":true,"options":["Sim","Nao"]},
      {"id":"adaptacao_como","label":"Como esta sua adaptacao?","type":"select","required":true,"active":true,"options":["Lenta","Normal","Rapida"]},
      {"id":"relacionamento_colegas","label":"Como e o relacionamento com os colegas?","type":"select","required":true,"active":true,"options":["Otimo","Bom","Regular","Ruim"]},
      {"id":"observacoes_adicionais","label":"Observacoes e comentarios adicionais","type":"textarea","required":false,"active":true}
    ]'::jsonb,
    true
  ),
  (
    'Avaliacao de desempenho',
    90,
    'performance',
    '[
      {"id":"avdp_instrucao","label":"Maior instrucao que o avaliado possui","type":"select","required":true,"active":true,"options":["Ensino Fundamental","Ensino Medio","Ensino Tecnico","Ensino Superior","Pos-graduacao"],"sectionTitle":"Instrucao"},
      {"id":"avdp_experiencia","label":"Experiencia que o avaliado possui, em anos","type":"select","required":true,"active":true,"options":["Menos de 1 ano","1 ano","2 anos","3 anos","4 anos","5 anos","6 a 9 anos","10 ou mais"],"sectionTitle":"Experiencia"},
      {"id":"avdp_atividade_eficiencia","label":"Eficiencia - fazer da forma correta","type":"select","required":true,"active":true,"options":["Domina e ensina","Executa sem auxilio","Algumas vezes precisa de auxilio","Muitas vezes precisa de auxilio","Sempre precisa de auxilio","Nao se aplica"],"sectionTitle":"Avaliacao das atividades","dynamicSource":"activities","dynamicRole":"efficiency"},
      {"id":"avdp_atividade_eficacia","label":"Eficacia - resultado e qualidade","type":"select","required":true,"active":true,"options":["Supera resultados","Atinge resultados","Na maioria das vezes atinge","Na maioria das vezes nao atinge","Nao atinge","Nao se aplica"],"sectionTitle":"Avaliacao das atividades","dynamicSource":"activities","dynamicRole":"efficacy"},
      {"id":"avdp_habilidade_cargo","label":"Avaliacao da habilidade","type":"select","required":true,"active":true,"options":["Destaca-se","Utiliza na pratica","Precisa melhorar um pouco","Precisa melhorar muito","Precisa melhorar urgentemente","Nao se aplica"],"sectionTitle":"Habilidades especificas do cargo","dynamicSource":"role_skills","dynamicRole":"rating"},
      {"id":"avdp_postura","label":"Avaliacao do comportamento","type":"select","required":true,"active":true,"options":["Destaca-se","Demonstra no dia a dia","Precisa melhorar em poucas situacoes","Precisa melhorar em muitas situacoes","Precisa melhorar urgentemente","Nao se aplica"],"sectionTitle":"Postura e comportamento","dynamicSource":"behavior","dynamicRole":"rating"}
    ]'::jsonb,
    true
  );
