-- Keep Area/Setor as the only dynamic project-area sources.
-- Other base fields, such as Nivelamento, must stay manual.
UPDATE public.base_fields
SET data_source = CASE
  WHEN field_key = 'nivelamento' THEN 'manual'
  WHEN field_key IN ('unidade_negocio', 'area') OR lower(label) = 'area' THEN 'areas'
  WHEN field_key IN ('departamento', 'setor') OR lower(label) = 'setor' THEN 'setores'
  ELSE 'manual'
END
WHERE data_source IN ('areas', 'setores')
   OR field_key IN ('unidade_negocio', 'area', 'departamento', 'setor', 'superior_imediato', 'nivelamento');

UPDATE public.base_fields
SET label = CASE
      WHEN field_key = 'cargo' THEN 'Nomenclatura do cargo visivel'
      WHEN field_key IN ('unidade_negocio', 'area') THEN 'Area'
      WHEN field_key IN ('departamento', 'setor') THEN 'Setor'
      WHEN field_key = 'nivelamento' THEN 'Nivelamento'
      WHEN field_key = 'superior_imediato' THEN 'Cargo do superior imediato'
      ELSE label
    END,
    field_type = CASE
      WHEN field_key IN ('unidade_negocio', 'area', 'departamento', 'setor') OR lower(label) IN ('area', 'setor') THEN 'single_select'::public.dynamic_field_type
      WHEN field_key = 'superior_imediato' THEN 'text'::public.dynamic_field_type
      ELSE field_type
    END,
    data_source = CASE
      WHEN field_key = 'nivelamento' THEN 'manual'
      WHEN field_key IN ('unidade_negocio', 'area') OR lower(label) = 'area' THEN 'areas'
      WHEN field_key IN ('departamento', 'setor') OR lower(label) = 'setor' THEN 'setores'
      ELSE 'manual'
    END
WHERE field_key IN ('cargo', 'unidade_negocio', 'area', 'departamento', 'setor', 'superior_imediato', 'nivelamento')
   OR lower(label) IN ('area', 'setor');

DELETE FROM public.base_options option
USING public.base_fields field
WHERE option.field_id = field.id
  AND (
    field.field_key IN ('unidade_negocio', 'area', 'departamento', 'setor')
    OR lower(field.label) IN ('area', 'setor')
  );

UPDATE public.base_fields
SET is_active = false,
    data_source = 'manual'
WHERE field_key <> 'superior_imediato'
  AND lower(label) = 'cargo do superior imediato';

CREATE OR REPLACE FUNCTION public.propagate_general_field_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.project_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.base_fields
  SET label = NEW.label,
      section = NEW.section,
      field_type = NEW.field_type,
      is_required = NEW.is_required,
      display_order = NEW.display_order,
      allows_multiple = NEW.allows_multiple,
      allows_free_text = NEW.allows_free_text,
      data_source = CASE
        WHEN NEW.field_key = 'nivelamento' THEN 'manual'
        WHEN NEW.field_key IN ('unidade_negocio', 'area') OR lower(NEW.label) = 'area' THEN 'areas'
        WHEN NEW.field_key IN ('departamento', 'setor') OR lower(NEW.label) = 'setor' THEN 'setores'
        ELSE 'manual'
      END,
      is_active = NEW.is_active
  WHERE source_field_id = NEW.id;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_propagate_general_field_update ON public.base_fields;
CREATE TRIGGER trg_propagate_general_field_update
  AFTER UPDATE ON public.base_fields
  FOR EACH ROW EXECUTE FUNCTION public.propagate_general_field_update();

CREATE OR REPLACE FUNCTION public.propagate_general_field_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  p record;
  new_id uuid;
BEGIN
  IF NEW.project_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  FOR p IN SELECT id, created_by FROM public.projects LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.base_fields
      WHERE project_id = p.id AND (source_field_id = NEW.id OR field_key = NEW.field_key)
    ) THEN
      INSERT INTO public.base_fields (
        project_id, source_field_id, field_key, label, section, field_type,
        is_required, display_order, allows_multiple, allows_free_text, data_source, is_active, created_by
      ) VALUES (
        p.id, NEW.id, NEW.field_key, NEW.label, NEW.section, NEW.field_type,
        NEW.is_required, NEW.display_order, NEW.allows_multiple, NEW.allows_free_text,
        CASE
          WHEN NEW.field_key = 'nivelamento' THEN 'manual'
          WHEN NEW.field_key IN ('unidade_negocio', 'area') OR lower(NEW.label) = 'area' THEN 'areas'
          WHEN NEW.field_key IN ('departamento', 'setor') OR lower(NEW.label) = 'setor' THEN 'setores'
          ELSE 'manual'
        END,
        NEW.is_active, p.created_by
      )
      RETURNING id INTO new_id;

      INSERT INTO public.base_options (field_id, source_option_id, label, value, description, display_order, is_active)
      SELECT new_id, option.id, option.label, option.value, option.description, option.display_order, option.is_active
      FROM public.base_options option
      WHERE option.field_id = NEW.id
      ORDER BY option.display_order, option.created_at;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_propagate_general_field_insert ON public.base_fields;
DROP TRIGGER IF EXISTS propagate_general_field_insert_trg ON public.base_fields;
CREATE TRIGGER trg_propagate_general_field_insert
  AFTER INSERT ON public.base_fields
  FOR EACH ROW EXECUTE FUNCTION public.propagate_general_field_insert();

CREATE OR REPLACE FUNCTION public.propagate_general_section_setting_upsert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  p record;
BEGIN
  IF NEW.project_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  FOR p IN SELECT id, created_by FROM public.projects LOOP
    UPDATE public.base_section_settings
    SET max_items = NEW.max_items,
        is_enabled = NEW.is_enabled
    WHERE project_id = p.id
      AND section = NEW.section;

    IF NOT FOUND THEN
      INSERT INTO public.base_section_settings (project_id, section, max_items, is_enabled, created_by)
      VALUES (p.id, NEW.section, NEW.max_items, NEW.is_enabled, p.created_by);
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_propagate_general_section_setting_insert ON public.base_section_settings;
CREATE TRIGGER trg_propagate_general_section_setting_insert
  AFTER INSERT ON public.base_section_settings
  FOR EACH ROW EXECUTE FUNCTION public.propagate_general_section_setting_upsert();

DROP TRIGGER IF EXISTS trg_propagate_general_section_setting_update ON public.base_section_settings;
CREATE TRIGGER trg_propagate_general_section_setting_update
  AFTER UPDATE ON public.base_section_settings
  FOR EACH ROW EXECUTE FUNCTION public.propagate_general_section_setting_upsert();

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
END;
$function$;
