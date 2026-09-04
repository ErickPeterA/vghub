ALTER TABLE public.performance_review_configs
  ADD COLUMN IF NOT EXISTS review_type text NOT NULL DEFAULT 'experience';

UPDATE public.performance_review_configs
SET review_type = 'experience'
WHERE review_type IS NULL;

ALTER TABLE public.performance_review_configs
  ALTER COLUMN review_type SET DEFAULT 'experience';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'performance_review_configs_review_type_check'
      AND conrelid = 'public.performance_review_configs'::regclass
  ) THEN
    ALTER TABLE public.performance_review_configs
      ADD CONSTRAINT performance_review_configs_review_type_check
      CHECK (review_type IN ('experience', 'performance'));
  END IF;
END $$;

DROP INDEX IF EXISTS performance_review_configs_project_period_unique;
DROP INDEX IF EXISTS performance_review_configs_general_period_unique;

CREATE UNIQUE INDEX IF NOT EXISTS performance_review_configs_project_type_period_unique
  ON public.performance_review_configs(project_id, review_type, period_days)
  WHERE project_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS performance_review_configs_general_type_period_unique
  ON public.performance_review_configs(review_type, period_days)
  WHERE project_id IS NULL;

CREATE INDEX IF NOT EXISTS performance_review_configs_project_type_order_idx
  ON public.performance_review_configs(project_id, review_type, period_days);

INSERT INTO public.performance_review_configs(project_id, name, period_days, review_type, questions_schema, is_active, created_by)
SELECT cfg.project_id, 'Desempenho', 90, 'performance', cfg.questions_schema, cfg.is_active, cfg.created_by
FROM public.performance_review_configs cfg
WHERE cfg.review_type = 'experience'
  AND cfg.period_days = 90
  AND NOT EXISTS (
    SELECT 1
    FROM public.performance_review_configs existing
    WHERE (
        existing.project_id = cfg.project_id
        OR (existing.project_id IS NULL AND cfg.project_id IS NULL)
      )
      AND existing.review_type = 'performance'
      AND existing.period_days = 90
  );

CREATE OR REPLACE FUNCTION public.propagate_global_performance_config()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.project_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.performance_review_configs(project_id, name, period_days, review_type, questions_schema, is_active, created_by)
  SELECT project.id, NEW.name, NEW.period_days, NEW.review_type, NEW.questions_schema, NEW.is_active, project.created_by
  FROM public.projects project
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.performance_review_configs cfg
    WHERE cfg.project_id = project.id
      AND cfg.review_type = NEW.review_type
      AND cfg.period_days = NEW.period_days
  );

  UPDATE public.performance_review_configs cfg
  SET
    name = NEW.name,
    questions_schema = NEW.questions_schema,
    is_active = NEW.is_active
  WHERE cfg.project_id IS NOT NULL
    AND cfg.review_type = NEW.review_type
    AND cfg.period_days = NEW.period_days;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_propagate_global_performance_config_insert ON public.performance_review_configs;
CREATE TRIGGER trg_propagate_global_performance_config_insert
  AFTER INSERT ON public.performance_review_configs
  FOR EACH ROW
  WHEN (NEW.project_id IS NULL)
  EXECUTE FUNCTION public.propagate_global_performance_config();

DROP TRIGGER IF EXISTS trg_propagate_global_performance_config_update ON public.performance_review_configs;
CREATE TRIGGER trg_propagate_global_performance_config_update
  AFTER UPDATE OF name, questions_schema, is_active ON public.performance_review_configs
  FOR EACH ROW
  WHEN (NEW.project_id IS NULL)
  EXECUTE FUNCTION public.propagate_global_performance_config();

CREATE OR REPLACE FUNCTION public.clone_general_base_to_project(_project_id uuid, _created_by uuid DEFAULT NULL::uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    AND NOT EXISTS (
      SELECT 1
      FROM public.performance_review_configs cfg
      WHERE cfg.project_id = _project_id
        AND cfg.review_type = template.review_type
        AND cfg.period_days = template.period_days
    );
END;
$function$;
