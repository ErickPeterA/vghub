CREATE TABLE public.evaluation_weight_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  career_key text NOT NULL,
  career_label text NOT NULL,
  weights jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
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
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT criterion_scoring_configs_key_not_blank CHECK (length(trim(criterion_key)) > 0),
  UNIQUE (project_id, criterion_key)
);

ALTER TABLE public.performance_reviews
  ADD COLUMN IF NOT EXISTS evaluation_weights_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS criterion_scoring_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX evaluation_weight_configs_project_idx
  ON public.evaluation_weight_configs(project_id);

CREATE INDEX criterion_scoring_configs_project_idx
  ON public.criterion_scoring_configs(project_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.evaluation_weight_configs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.criterion_scoring_configs TO authenticated;
GRANT ALL ON public.evaluation_weight_configs TO service_role;
GRANT ALL ON public.criterion_scoring_configs TO service_role;

ALTER TABLE public.evaluation_weight_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.criterion_scoring_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "evaluation weights select for project members"
  ON public.evaluation_weight_configs FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = project_id
        AND (p.responsavel_id = auth.uid() OR p.created_by = auth.uid())
    )
    OR public.is_project_member(auth.uid(), project_id)
  );

CREATE POLICY "evaluation weights manage by GP"
  ON public.evaluation_weight_configs FOR ALL TO authenticated
  USING (public.can_manage_project_base(auth.uid(), project_id))
  WITH CHECK (public.can_manage_project_base(auth.uid(), project_id));

CREATE POLICY "criterion scoring select for project members"
  ON public.criterion_scoring_configs FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = project_id
        AND (p.responsavel_id = auth.uid() OR p.created_by = auth.uid())
    )
    OR public.is_project_member(auth.uid(), project_id)
  );

CREATE POLICY "criterion scoring manage by GP"
  ON public.criterion_scoring_configs FOR ALL TO authenticated
  USING (public.can_manage_project_base(auth.uid(), project_id))
  WITH CHECK (public.can_manage_project_base(auth.uid(), project_id));

CREATE TRIGGER trg_evaluation_weight_configs_updated_at
  BEFORE UPDATE ON public.evaluation_weight_configs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_criterion_scoring_configs_updated_at
  BEFORE UPDATE ON public.criterion_scoring_configs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
