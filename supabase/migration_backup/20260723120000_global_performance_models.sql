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

DROP POLICY IF EXISTS "Admins can create general fields" ON public.base_fields;
CREATE POLICY "Admins can create general fields"
ON public.base_fields FOR INSERT TO authenticated
WITH CHECK (
  (project_id IS NULL AND public.is_any_gp(auth.uid()))
  OR (project_id IS NOT NULL AND public.can_manage_project_base(auth.uid(), project_id))
);

DROP POLICY IF EXISTS "Managers can update available fields" ON public.base_fields;
CREATE POLICY "Managers can update available fields"
ON public.base_fields FOR UPDATE TO authenticated
USING (
  (project_id IS NULL AND public.is_any_gp(auth.uid()))
  OR (project_id IS NOT NULL AND public.can_manage_project_base(auth.uid(), project_id))
)
WITH CHECK (
  (project_id IS NULL AND public.is_any_gp(auth.uid()))
  OR (project_id IS NOT NULL AND public.can_manage_project_base(auth.uid(), project_id))
);

DROP POLICY IF EXISTS "Managers can delete available fields" ON public.base_fields;
CREATE POLICY "Managers can delete available fields"
ON public.base_fields FOR DELETE TO authenticated
USING (
  (project_id IS NULL AND public.is_any_gp(auth.uid()))
  OR (project_id IS NOT NULL AND public.can_manage_project_base(auth.uid(), project_id))
);

DROP POLICY IF EXISTS "Managers can create options" ON public.base_options;
CREATE POLICY "Managers can create options"
ON public.base_options FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.base_fields field
  WHERE field.id = field_id
    AND (
      (field.project_id IS NULL AND public.is_any_gp(auth.uid()))
      OR (field.project_id IS NOT NULL AND public.can_manage_project_base(auth.uid(), field.project_id))
    )
));

DROP POLICY IF EXISTS "Managers can update options" ON public.base_options;
CREATE POLICY "Managers can update options"
ON public.base_options FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.base_fields field
  WHERE field.id = field_id
    AND (
      (field.project_id IS NULL AND public.is_any_gp(auth.uid()))
      OR (field.project_id IS NOT NULL AND public.can_manage_project_base(auth.uid(), field.project_id))
    )
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.base_fields field
  WHERE field.id = field_id
    AND (
      (field.project_id IS NULL AND public.is_any_gp(auth.uid()))
      OR (field.project_id IS NOT NULL AND public.can_manage_project_base(auth.uid(), field.project_id))
    )
));

DROP POLICY IF EXISTS "Managers can delete options" ON public.base_options;
CREATE POLICY "Managers can delete options"
ON public.base_options FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.base_fields field
  WHERE field.id = field_id
    AND (
      (field.project_id IS NULL AND public.is_any_gp(auth.uid()))
      OR (field.project_id IS NOT NULL AND public.can_manage_project_base(auth.uid(), field.project_id))
    )
));

DROP POLICY IF EXISTS "Managers can create section settings" ON public.base_section_settings;
CREATE POLICY "Managers can create section settings"
ON public.base_section_settings FOR INSERT TO authenticated
WITH CHECK (
  (project_id IS NULL AND public.is_any_gp(auth.uid()))
  OR (project_id IS NOT NULL AND public.can_manage_project_base(auth.uid(), project_id))
);

DROP POLICY IF EXISTS "Managers can update section settings" ON public.base_section_settings;
CREATE POLICY "Managers can update section settings"
ON public.base_section_settings FOR UPDATE TO authenticated
USING (
  (project_id IS NULL AND public.is_any_gp(auth.uid()))
  OR (project_id IS NOT NULL AND public.can_manage_project_base(auth.uid(), project_id))
)
WITH CHECK (
  (project_id IS NULL AND public.is_any_gp(auth.uid()))
  OR (project_id IS NOT NULL AND public.can_manage_project_base(auth.uid(), project_id))
);

DROP POLICY IF EXISTS "Managers can delete section settings" ON public.base_section_settings;
CREATE POLICY "Managers can delete section settings"
ON public.base_section_settings FOR DELETE TO authenticated
USING (
  (project_id IS NULL AND public.is_any_gp(auth.uid()))
  OR (project_id IS NOT NULL AND public.can_manage_project_base(auth.uid(), project_id))
);

ALTER TABLE public.performance_review_configs
  ALTER COLUMN project_id DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS performance_review_configs_general_period_unique
  ON public.performance_review_configs(period_days)
  WHERE project_id IS NULL;

DROP POLICY IF EXISTS "performance configs select for project members" ON public.performance_review_configs;
CREATE POLICY "performance configs select for project members"
  ON public.performance_review_configs FOR SELECT TO authenticated
  USING (
    (project_id IS NULL AND public.is_any_gp(auth.uid()))
    OR public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND (p.responsavel_id = auth.uid() OR p.created_by = auth.uid()))
    OR public.is_project_member(auth.uid(), project_id)
  );

DROP POLICY IF EXISTS "performance configs manage by GP" ON public.performance_review_configs;
CREATE POLICY "performance configs manage by GP"
  ON public.performance_review_configs FOR ALL TO authenticated
  USING (
    (project_id IS NULL AND public.is_any_gp(auth.uid()))
    OR (project_id IS NOT NULL AND public.can_manage_project_base(auth.uid(), project_id))
  )
  WITH CHECK (
    (project_id IS NULL AND public.is_any_gp(auth.uid()))
    OR (project_id IS NOT NULL AND public.can_manage_project_base(auth.uid(), project_id))
  );

WITH default_questions AS (
  SELECT '[
    {"id":"qualidade_entrega","label":"Qualidade das entregas","type":"select","required":true,"active":true,"options":["Abaixo do esperado","Dentro do esperado","Acima do esperado"]},
    {"id":"cumprimento_prazos","label":"Cumprimento de prazos","type":"select","required":true,"active":true,"options":["Abaixo do esperado","Dentro do esperado","Acima do esperado"]},
    {"id":"comunicacao","label":"Comunicacao e colaboracao","type":"select","required":true,"active":true,"options":["Abaixo do esperado","Dentro do esperado","Acima do esperado"]},
    {"id":"pontos_fortes","label":"Pontos fortes observados","type":"textarea","required":false,"active":true},
    {"id":"pontos_desenvolver","label":"Pontos a desenvolver","type":"textarea","required":false,"active":true}
  ]'::jsonb AS questions_schema
)
INSERT INTO public.performance_review_configs(project_id, name, period_days, questions_schema, is_active, created_by)
SELECT NULL, template.name, template.period_days, default_questions.questions_schema, true, NULL
FROM default_questions
CROSS JOIN (
  VALUES ('30 dias', 30), ('45 dias', 45), ('90 dias', 90)
) AS template(name, period_days)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.performance_review_configs cfg
  WHERE cfg.project_id IS NULL
    AND cfg.period_days = template.period_days
);

INSERT INTO public.performance_review_configs(project_id, name, period_days, questions_schema, is_active, created_by)
SELECT project.id, template.name, template.period_days, template.questions_schema, template.is_active, project.created_by
FROM public.projects project
CROSS JOIN public.performance_review_configs template
WHERE template.project_id IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.performance_review_configs cfg
    WHERE cfg.project_id = project.id
      AND cfg.period_days = template.period_days
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

  INSERT INTO public.performance_review_configs(project_id, name, period_days, questions_schema, is_active, created_by)
  SELECT project.id, NEW.name, NEW.period_days, NEW.questions_schema, NEW.is_active, project.created_by
  FROM public.projects project
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.performance_review_configs cfg
    WHERE cfg.project_id = project.id
      AND cfg.period_days = NEW.period_days
  );

  UPDATE public.performance_review_configs cfg
  SET
    name = NEW.name,
    questions_schema = NEW.questions_schema,
    is_active = NEW.is_active
  WHERE cfg.project_id IS NOT NULL
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

  INSERT INTO public.performance_review_configs(project_id, name, period_days, questions_schema, is_active, created_by)
  SELECT _project_id, template.name, template.period_days, template.questions_schema, template.is_active, _created_by
  FROM public.performance_review_configs template
  WHERE template.project_id IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.performance_review_configs cfg
      WHERE cfg.project_id = _project_id
        AND cfg.period_days = template.period_days
    );
END;
$function$;
