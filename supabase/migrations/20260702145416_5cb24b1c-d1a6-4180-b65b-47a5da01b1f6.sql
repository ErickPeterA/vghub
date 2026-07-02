
-- Enum para status do link de atividade
DO $$ BEGIN
  CREATE TYPE public.activity_link_status AS ENUM ('pending', 'answered', 'expired', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================
-- activity_configs
-- =========================================
CREATE TABLE public.activity_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  header_schema JSONB NOT NULL DEFAULT '[]'::jsonb,
  questions_schema JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_configs TO authenticated;
GRANT ALL ON public.activity_configs TO service_role;

ALTER TABLE public.activity_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activity_configs select for project members"
  ON public.activity_configs FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND (p.responsavel_id = auth.uid() OR p.created_by = auth.uid()))
    OR public.is_project_member(auth.uid(), project_id)
  );

CREATE POLICY "activity_configs manage by GP"
  ON public.activity_configs FOR ALL TO authenticated
  USING (public.can_manage_project_base(auth.uid(), project_id))
  WITH CHECK (public.can_manage_project_base(auth.uid(), project_id));

CREATE TRIGGER trg_activity_configs_updated_at
  BEFORE UPDATE ON public.activity_configs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================
-- activity_links
-- =========================================
CREATE TABLE public.activity_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  config_id UUID NOT NULL REFERENCES public.activity_configs(id) ON DELETE CASCADE,
  token UUID NOT NULL DEFAULT gen_random_uuid(),
  status public.activity_link_status NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL,
  answered_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  label TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (token)
);

CREATE INDEX idx_activity_links_project ON public.activity_links(project_id);
CREATE INDEX idx_activity_links_status ON public.activity_links(project_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_links TO authenticated;
GRANT ALL ON public.activity_links TO service_role;

ALTER TABLE public.activity_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activity_links select for project members"
  ON public.activity_links FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND (p.responsavel_id = auth.uid() OR p.created_by = auth.uid()))
    OR public.is_project_member(auth.uid(), project_id)
  );

CREATE POLICY "activity_links manage by GP"
  ON public.activity_links FOR ALL TO authenticated
  USING (public.can_manage_project_base(auth.uid(), project_id))
  WITH CHECK (public.can_manage_project_base(auth.uid(), project_id));

CREATE TRIGGER trg_activity_links_updated_at
  BEFORE UPDATE ON public.activity_links
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================
-- activity_responses
-- =========================================
CREATE TABLE public.activity_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id UUID NOT NULL REFERENCES public.activity_links(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  header_answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  question_answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_responses_link ON public.activity_responses(link_id);
CREATE INDEX idx_activity_responses_project ON public.activity_responses(project_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_responses TO authenticated;
GRANT ALL ON public.activity_responses TO service_role;

ALTER TABLE public.activity_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activity_responses select for project members"
  ON public.activity_responses FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND (p.responsavel_id = auth.uid() OR p.created_by = auth.uid()))
    OR public.is_project_member(auth.uid(), project_id)
  );

CREATE POLICY "activity_responses manage by GP"
  ON public.activity_responses FOR ALL TO authenticated
  USING (public.can_manage_project_base(auth.uid(), project_id))
  WITH CHECK (public.can_manage_project_base(auth.uid(), project_id));

CREATE TRIGGER trg_activity_responses_updated_at
  BEFORE UPDATE ON public.activity_responses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
