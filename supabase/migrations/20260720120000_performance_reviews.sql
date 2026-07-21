DO $$ BEGIN
  CREATE TYPE public.performance_participant_type AS ENUM ('collaborator', 'leader');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.performance_participant_status AS ENUM ('not_sent', 'sent', 'accessed', 'in_progress', 'answered');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.performance_review_status AS ENUM ('draft', 'waiting_responses', 'ready_for_comparison', 'finalized');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.performance_review_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  questions_schema jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id)
);

CREATE TABLE public.performance_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  config_id uuid REFERENCES public.performance_review_configs(id) ON DELETE SET NULL,
  name text NOT NULL,
  employee_position_id uuid NOT NULL REFERENCES public.project_positions(id) ON DELETE RESTRICT,
  leader_position_id uuid NOT NULL REFERENCES public.project_positions(id) ON DELETE RESTRICT,
  job_description_id uuid NOT NULL REFERENCES public.descricoes_cargo(id) ON DELETE RESTRICT,
  employee_name text NOT NULL,
  leader_name text NOT NULL,
  job_title text NOT NULL,
  job_description_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  activities_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  questions_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  status public.performance_review_status NOT NULL DEFAULT 'waiting_responses',
  finalized_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  finalized_at timestamptz,
  reopened_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reopened_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT performance_reviews_name_not_blank CHECK (length(trim(name)) > 0)
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
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_performance_reviews_project ON public.performance_reviews(project_id, status);
CREATE INDEX idx_performance_reviews_job_description ON public.performance_reviews(project_id, job_description_id);
CREATE INDEX idx_performance_participants_review ON public.performance_review_participants(review_id);
CREATE INDEX idx_performance_comments_review_question ON public.performance_review_comments(review_id, question_key);
CREATE INDEX idx_performance_history_review_question ON public.performance_answer_history(review_id, question_key);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.performance_review_configs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.performance_reviews TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.performance_review_participants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.performance_review_comments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.performance_answer_history TO authenticated;
GRANT ALL ON public.performance_review_configs TO service_role;
GRANT ALL ON public.performance_reviews TO service_role;
GRANT ALL ON public.performance_review_participants TO service_role;
GRANT ALL ON public.performance_review_comments TO service_role;
GRANT ALL ON public.performance_answer_history TO service_role;

ALTER TABLE public.performance_review_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_review_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_review_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_answer_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "performance configs select for project members"
  ON public.performance_review_configs FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND (p.responsavel_id = auth.uid() OR p.created_by = auth.uid()))
    OR public.is_project_member(auth.uid(), project_id)
  );

CREATE POLICY "performance configs manage by GP"
  ON public.performance_review_configs FOR ALL TO authenticated
  USING (public.can_manage_project_base(auth.uid(), project_id))
  WITH CHECK (public.can_manage_project_base(auth.uid(), project_id));

CREATE POLICY "performance reviews select for project members"
  ON public.performance_reviews FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND (p.responsavel_id = auth.uid() OR p.created_by = auth.uid()))
    OR public.is_project_member(auth.uid(), project_id)
  );

CREATE POLICY "performance reviews manage by GP"
  ON public.performance_reviews FOR ALL TO authenticated
  USING (public.can_manage_project_base(auth.uid(), project_id))
  WITH CHECK (public.can_manage_project_base(auth.uid(), project_id));

CREATE POLICY "performance participants select for project members"
  ON public.performance_review_participants FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND (p.responsavel_id = auth.uid() OR p.created_by = auth.uid()))
    OR public.is_project_member(auth.uid(), project_id)
  );

CREATE POLICY "performance participants manage by GP"
  ON public.performance_review_participants FOR ALL TO authenticated
  USING (public.can_manage_project_base(auth.uid(), project_id))
  WITH CHECK (public.can_manage_project_base(auth.uid(), project_id));

CREATE POLICY "performance comments select for project members"
  ON public.performance_review_comments FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.performance_reviews r
    WHERE r.id = review_id
      AND (
        public.is_admin(auth.uid())
        OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = r.project_id AND (p.responsavel_id = auth.uid() OR p.created_by = auth.uid()))
        OR public.is_project_member(auth.uid(), r.project_id)
      )
  ));

CREATE POLICY "performance comments insert for project members"
  ON public.performance_review_comments FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = author_id
    AND EXISTS (
      SELECT 1 FROM public.performance_reviews r
      WHERE r.id = review_id
        AND r.status <> 'finalized'
        AND (
          public.is_admin(auth.uid())
          OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = r.project_id AND (p.responsavel_id = auth.uid() OR p.created_by = auth.uid()))
          OR public.is_project_member(auth.uid(), r.project_id)
        )
    )
  );

CREATE POLICY "performance history select for project members"
  ON public.performance_answer_history FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.performance_reviews r
    WHERE r.id = review_id
      AND (
        public.is_admin(auth.uid())
        OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = r.project_id AND (p.responsavel_id = auth.uid() OR p.created_by = auth.uid()))
        OR public.is_project_member(auth.uid(), r.project_id)
      )
  ));

CREATE POLICY "performance history insert by GP"
  ON public.performance_answer_history FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.performance_reviews r
    WHERE r.id = review_id
      AND r.status <> 'finalized'
      AND public.can_manage_project_base(auth.uid(), r.project_id)
  ));

CREATE TRIGGER trg_performance_review_configs_updated_at
  BEFORE UPDATE ON public.performance_review_configs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_performance_reviews_updated_at
  BEFORE UPDATE ON public.performance_reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_performance_participants_updated_at
  BEFORE UPDATE ON public.performance_review_participants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

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

CREATE TRIGGER trg_performance_participants_refresh_status
  AFTER INSERT OR UPDATE OF status OR DELETE ON public.performance_review_participants
  FOR EACH ROW EXECUTE FUNCTION public.trg_refresh_performance_review_status();
