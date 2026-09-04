
DROP TABLE IF EXISTS public.descricoes_cargo CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

DO $$ BEGIN CREATE TYPE public.app_role AS ENUM ('admin','user'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.project_role AS ENUM ('admin','lider_estrategico','lider_tatico','lider_operacional','gp'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.user_status AS ENUM ('ativo','inativo'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.project_status AS ENUM ('ativo','arquivado'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL,
  email text NOT NULL UNIQUE,
  status public.user_status NOT NULL DEFAULT 'ativo',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_profiles_upd BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- user_roles
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- projects
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  empresa text,
  status public.project_status NOT NULL DEFAULT 'ativo',
  responsavel_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_projects_upd BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- project_members (precisa existir antes das funções)
CREATE TABLE public.project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.project_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_members TO authenticated;
GRANT ALL ON public.project_members TO service_role;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- security definer helpers (depois das tabelas)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'admin'::public.app_role);
$$;

CREATE OR REPLACE FUNCTION public.is_project_member(_user_id uuid, _project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.project_members WHERE user_id = _user_id AND project_id = _project_id);
$$;

CREATE OR REPLACE FUNCTION public.get_project_role(_user_id uuid, _project_id uuid)
RETURNS public.project_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.project_members WHERE user_id = _user_id AND project_id = _project_id LIMIT 1;
$$;

-- descricoes_cargo
CREATE TABLE public.descricoes_cargo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.descricoes_cargo TO authenticated;
GRANT ALL ON public.descricoes_cargo TO service_role;
ALTER TABLE public.descricoes_cargo ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_dc_upd BEFORE UPDATE ON public.descricoes_cargo FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- project_templates
CREATE TABLE public.project_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL,
  tipo text NOT NULL DEFAULT 'geral',
  descricao text,
  conteudo jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_templates TO authenticated;
GRANT ALL ON public.project_templates TO service_role;
ALTER TABLE public.project_templates ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_tpl_upd BEFORE UPDATE ON public.project_templates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- project_hub
CREATE TABLE public.project_hub (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  secao text NOT NULL DEFAULT 'nota',
  titulo text NOT NULL,
  conteudo text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_hub TO authenticated;
GRANT ALL ON public.project_hub TO service_role;
ALTER TABLE public.project_hub ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_hub_upd BEFORE UPDATE ON public.project_hub FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- project_history
CREATE TABLE public.project_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  acao text NOT NULL,
  entidade text,
  entidade_id uuid,
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.project_history TO authenticated;
GRANT ALL ON public.project_history TO service_role;
ALTER TABLE public.project_history ENABLE ROW LEVEL SECURITY;

-- project_progress
CREATE TABLE public.project_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  etapa text NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  percentual int NOT NULL DEFAULT 0,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_progress TO authenticated;
GRANT ALL ON public.project_progress TO service_role;
ALTER TABLE public.project_progress ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_prog_upd BEFORE UPDATE ON public.project_progress FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- POLICIES
CREATE POLICY "profiles read" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.is_admin(auth.uid()));
CREATE POLICY "profiles update" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id OR public.is_admin(auth.uid()));
CREATE POLICY "profiles insert" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) OR auth.uid() = id);
CREATE POLICY "profiles delete" ON public.profiles FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "roles read" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE POLICY "projects read" ON public.projects FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_project_member(auth.uid(), id));
CREATE POLICY "projects insert" ON public.projects FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "projects update" ON public.projects FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()));
CREATE POLICY "projects delete" ON public.projects FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "members read" ON public.project_members FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR user_id = auth.uid());
CREATE POLICY "members write" ON public.project_members FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "dc read" ON public.descricoes_cargo FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_project_member(auth.uid(), project_id));
CREATE POLICY "dc insert" ON public.descricoes_cargo FOR INSERT TO authenticated
  WITH CHECK ((public.is_admin(auth.uid()) OR public.is_project_member(auth.uid(), project_id)) AND created_by = auth.uid());
CREATE POLICY "dc update" ON public.descricoes_cargo FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_project_member(auth.uid(), project_id));
CREATE POLICY "dc delete" ON public.descricoes_cargo FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_project_member(auth.uid(), project_id));

CREATE POLICY "tpl read" ON public.project_templates FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_project_member(auth.uid(), project_id));
CREATE POLICY "tpl write" ON public.project_templates FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_project_member(auth.uid(), project_id))
  WITH CHECK ((public.is_admin(auth.uid()) OR public.is_project_member(auth.uid(), project_id)) AND created_by = auth.uid());

CREATE POLICY "hub read" ON public.project_hub FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_project_member(auth.uid(), project_id));
CREATE POLICY "hub write" ON public.project_hub FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_project_member(auth.uid(), project_id))
  WITH CHECK ((public.is_admin(auth.uid()) OR public.is_project_member(auth.uid(), project_id)) AND created_by = auth.uid());

CREATE POLICY "hist read" ON public.project_history FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_project_member(auth.uid(), project_id));
CREATE POLICY "hist insert" ON public.project_history FOR INSERT TO authenticated
  WITH CHECK ((public.is_admin(auth.uid()) OR public.is_project_member(auth.uid(), project_id)) AND user_id = auth.uid());

CREATE POLICY "prog read" ON public.project_progress FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_project_member(auth.uid(), project_id));
CREATE POLICY "prog write" ON public.project_progress FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_project_member(auth.uid(), project_id))
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_project_member(auth.uid(), project_id));

-- auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
