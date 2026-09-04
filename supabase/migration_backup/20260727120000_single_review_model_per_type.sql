DROP INDEX IF EXISTS performance_review_configs_project_type_period_unique;
DROP INDEX IF EXISTS performance_review_configs_general_type_period_unique;

WITH ranked_configs AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY COALESCE(project_id::text, 'global'), review_type
      ORDER BY is_active DESC, period_days ASC, created_at ASC
    ) AS rank
  FROM public.performance_review_configs
)
UPDATE public.performance_review_configs config
SET is_active = false
FROM ranked_configs ranked
WHERE config.id = ranked.id
  AND ranked.rank > 1
  AND config.is_active = true;

UPDATE public.performance_review_configs
SET name = CASE
  WHEN review_type = 'experience' THEN 'Avaliacao de experiencia'
  ELSE 'Avaliacao de desempenho'
END
WHERE is_active = true
  AND (
    name IS NULL
    OR name IN ('30 dias', '45 dias', '90 dias', 'Desempenho')
    OR name ~ '^[0-9]+ dias$'
  );

CREATE UNIQUE INDEX IF NOT EXISTS performance_review_configs_project_active_type_unique
  ON public.performance_review_configs(project_id, review_type)
  WHERE project_id IS NOT NULL
    AND is_active = true;

CREATE UNIQUE INDEX IF NOT EXISTS performance_review_configs_general_active_type_unique
  ON public.performance_review_configs(review_type)
  WHERE project_id IS NULL
    AND is_active = true;

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
  WHERE NEW.is_active = true
    AND NOT EXISTS (
      SELECT 1
      FROM public.performance_review_configs cfg
      WHERE cfg.project_id = project.id
        AND cfg.review_type = NEW.review_type
        AND cfg.is_active = true
    );

  UPDATE public.performance_review_configs cfg
  SET
    name = NEW.name,
    questions_schema = NEW.questions_schema,
    is_active = NEW.is_active
  WHERE cfg.project_id IS NOT NULL
    AND cfg.review_type = NEW.review_type
    AND cfg.is_active = true;

  RETURN NEW;
END;
$function$;

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
    AND template.is_active = true
    AND NOT EXISTS (
      SELECT 1
      FROM public.performance_review_configs cfg
      WHERE cfg.project_id = _project_id
        AND cfg.review_type = template.review_type
        AND cfg.is_active = true
    );
END;
$function$;
