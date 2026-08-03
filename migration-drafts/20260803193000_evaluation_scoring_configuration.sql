-- Execute após as migrations existentes de projetos, bases e avaliações.

CREATE TABLE public.evaluation_weights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  career_key text NOT NULL,
  career_label text NOT NULL,
  criterion_key text NOT NULL,
  weight_percent numeric(5,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT evaluation_weights_career_key_not_blank CHECK (length(trim(career_key)) > 0),
  CONSTRAINT evaluation_weights_career_label_not_blank CHECK (length(trim(career_label)) > 0),
  CONSTRAINT evaluation_weights_criterion_key_check CHECK (criterion_key IN (
    'instruction', 'experience', 'activities', 'indicators',
    'culture_skills', 'role_skills', 'behavior'
  )),
  CONSTRAINT evaluation_weights_percent_check CHECK (weight_percent >= 0 AND weight_percent <= 100),
  UNIQUE (project_id, career_key, criterion_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.evaluation_weights TO authenticated;
GRANT ALL ON public.evaluation_weights TO service_role;
ALTER TABLE public.evaluation_weights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "evaluation weights select for project members"
  ON public.evaluation_weights FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.projects project
      WHERE project.id = project_id
        AND (project.responsavel_id = auth.uid() OR project.created_by = auth.uid())
    )
    OR public.is_project_member(auth.uid(), project_id)
  );

CREATE POLICY "evaluation weights manage by GP"
  ON public.evaluation_weights FOR ALL TO authenticated
  USING (public.can_manage_project_base(auth.uid(), project_id))
  WITH CHECK (public.can_manage_project_base(auth.uid(), project_id));

CREATE TABLE public.criterion_scoring_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  career_key text NOT NULL,
  career_label text NOT NULL,
  criterion_key text NOT NULL,
  rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT criterion_scoring_career_key_not_blank CHECK (length(trim(career_key)) > 0),
  CONSTRAINT criterion_scoring_career_label_not_blank CHECK (length(trim(career_label)) > 0),
  CONSTRAINT criterion_scoring_criterion_key_check CHECK (criterion_key IN (
    'instruction', 'experience', 'activities', 'indicators',
    'culture_skills', 'role_skills', 'behavior'
  )),
  CONSTRAINT criterion_scoring_rules_array_check CHECK (jsonb_typeof(rules) = 'array'),
  UNIQUE (project_id, career_key, criterion_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.criterion_scoring_configs TO authenticated;
GRANT ALL ON public.criterion_scoring_configs TO service_role;
ALTER TABLE public.criterion_scoring_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "criterion scoring select for project members"
  ON public.criterion_scoring_configs FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.projects project
      WHERE project.id = project_id
        AND (project.responsavel_id = auth.uid() OR project.created_by = auth.uid())
    )
    OR public.is_project_member(auth.uid(), project_id)
  );

CREATE POLICY "criterion scoring manage by GP"
  ON public.criterion_scoring_configs FOR ALL TO authenticated
  USING (public.can_manage_project_base(auth.uid(), project_id))
  WITH CHECK (public.can_manage_project_base(auth.uid(), project_id));

CREATE TRIGGER trg_evaluation_weights_updated_at
  BEFORE UPDATE ON public.evaluation_weights
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_criterion_scoring_configs_updated_at
  BEFORE UPDATE ON public.criterion_scoring_configs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.performance_reviews
  ADD COLUMN weights_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN scoring_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE OR REPLACE FUNCTION public.capture_performance_scoring_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  selected_career text;
BEGIN
  selected_career := COALESCE(
    NULLIF(NEW.job_description_snapshot ->> 'tipo_carreira', ''),
    NULLIF(NEW.job_description_snapshot -> 'dynamic_values' ->> 'tipo_carreira', '')
  );

  SELECT COALESCE(jsonb_agg(to_jsonb(weight_row) ORDER BY weight_row.criterion_key), '[]'::jsonb)
  INTO NEW.weights_snapshot
  FROM (
    SELECT career_key, career_label, criterion_key, weight_percent
    FROM public.evaluation_weights
    WHERE project_id = NEW.project_id AND career_key = selected_career
  ) AS weight_row;

  SELECT COALESCE(jsonb_agg(to_jsonb(scoring_row) ORDER BY scoring_row.criterion_key), '[]'::jsonb)
  INTO NEW.scoring_snapshot
  FROM (
    SELECT career_key, career_label, criterion_key, rules
    FROM public.criterion_scoring_configs
    WHERE project_id = NEW.project_id AND career_key = selected_career
  ) AS scoring_row;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.capture_performance_scoring_snapshot() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.capture_performance_scoring_snapshot() TO service_role;

CREATE TRIGGER trg_capture_performance_scoring_snapshot
  BEFORE INSERT ON public.performance_reviews
  FOR EACH ROW EXECUTE FUNCTION public.capture_performance_scoring_snapshot();

COMMENT ON COLUMN public.performance_reviews.weights_snapshot IS
  'Cópia imutável dos pesos da carreira vigente no momento da criação da avaliação.';
COMMENT ON COLUMN public.performance_reviews.scoring_snapshot IS
  'Cópia imutável das regras de pontuação vigentes no momento da criação da avaliação.';