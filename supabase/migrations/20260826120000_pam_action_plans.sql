DO $$ BEGIN
  CREATE TYPE public.pam_status AS ENUM ('draft', 'released', 'in_progress', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.pam_item_status AS ENUM ('not_started', 'in_progress', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

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
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
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

CREATE INDEX idx_pam_project_status ON public.pam(project_id, status);
CREATE INDEX idx_pam_review ON public.pam(review_id);
CREATE INDEX idx_pam_token ON public.pam(token);
CREATE INDEX idx_pam_items_pam_order ON public.pam_items(pam_id, display_order);
CREATE UNIQUE INDEX idx_pam_items_unique_source
  ON public.pam_items(pam_id, source, source_key)
  WHERE source_key IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pam TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pam_items TO authenticated;
GRANT ALL ON public.pam TO service_role;
GRANT ALL ON public.pam_items TO service_role;

ALTER TABLE public.pam ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pam_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pam select for project members"
  ON public.pam FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND (p.responsavel_id = auth.uid() OR p.created_by = auth.uid()))
    OR public.is_project_member(auth.uid(), project_id)
  );

CREATE POLICY "pam manage by GP"
  ON public.pam FOR ALL TO authenticated
  USING (public.can_manage_project_base(auth.uid(), project_id))
  WITH CHECK (public.can_manage_project_base(auth.uid(), project_id));

CREATE POLICY "pam items select for project members"
  ON public.pam_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.pam p
    WHERE p.id = pam_id
      AND (
        public.is_admin(auth.uid())
        OR EXISTS (SELECT 1 FROM public.projects pr WHERE pr.id = p.project_id AND (pr.responsavel_id = auth.uid() OR pr.created_by = auth.uid()))
        OR public.is_project_member(auth.uid(), p.project_id)
      )
  ));

CREATE POLICY "pam items manage by GP"
  ON public.pam_items FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.pam p
    WHERE p.id = pam_id
      AND public.can_manage_project_base(auth.uid(), p.project_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.pam p
    WHERE p.id = pam_id
      AND public.can_manage_project_base(auth.uid(), p.project_id)
  ));

CREATE TRIGGER trg_pam_updated_at
  BEFORE UPDATE ON public.pam
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_pam_items_updated_at
  BEFORE UPDATE ON public.pam_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

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

CREATE TRIGGER trg_performance_reviews_create_pam
  AFTER INSERT OR UPDATE OF status ON public.performance_reviews
  FOR EACH ROW EXECUTE FUNCTION public.create_pam_from_finalized_review();
