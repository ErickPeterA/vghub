UPDATE public.pam_items
SET improvement_point = CASE
  WHEN source_key ~ '^activities_[0-9]+$' THEN trim('Atividade ' || substring(source_key from '[0-9]+$'))
  WHEN source_key ~ '^indicators_[0-9]+$' THEN trim('Indicador ' || substring(source_key from '[0-9]+$'))
  WHEN source_key ~ '^culture_skills_[0-9]+$' THEN trim('Habilidade cultural ' || substring(source_key from '[0-9]+$'))
  WHEN source_key ~ '^role_skills_[0-9]+$' THEN trim('Habilidade do cargo ' || substring(source_key from '[0-9]+$'))
  WHEN source_key ~ '^behavior_[0-9]+$' THEN trim('Postura e comportamento ' || substring(source_key from '[0-9]+$'))
  ELSE COALESCE(NULLIF(skill_label, ''), 'Ponto de melhoria')
END
WHERE source = 'performance_review'
  AND (
    improvement_point ~ '[ _-][0-9]{10,}$'
    OR lower(improvement_point) IN (
      'diariamente',
      'semanalmente',
      'quinzenalmente',
      'mensalmente',
      'bimensalmente',
      'trimestralmente',
      'semestralmente',
      'anualmente'
    )
    OR lower(regexp_replace(improvement_point, '[ _-]*[0-9]{10,}$', '')) IN (
      'diariamente',
      'semanalmente',
      'quinzenalmente',
      'mensalmente',
      'bimensalmente',
      'trimestralmente',
      'semestralmente',
      'anualmente'
    )
  );

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

DROP TRIGGER IF EXISTS trg_performance_reviews_create_pam ON public.performance_reviews;

CREATE TRIGGER trg_performance_reviews_create_pam
  AFTER INSERT OR UPDATE OF status ON public.performance_reviews
  FOR EACH ROW EXECUTE FUNCTION public.create_pam_from_finalized_review();
