
-- 1) Fix clone function to include description
CREATE OR REPLACE FUNCTION public.clone_general_base_to_project(_project_id uuid, _created_by uuid DEFAULT NULL::uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE source_field record; new_field_id uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.base_fields WHERE project_id = _project_id) THEN RETURN; END IF;
  FOR source_field IN SELECT * FROM public.base_fields WHERE project_id IS NULL ORDER BY display_order, created_at LOOP
    INSERT INTO public.base_fields (project_id, source_field_id, field_key, label, section, field_type, is_required, display_order, allows_multiple, allows_free_text, is_active, created_by)
    VALUES (_project_id, source_field.id, source_field.field_key, source_field.label, source_field.section, source_field.field_type, source_field.is_required, source_field.display_order, source_field.allows_multiple, source_field.allows_free_text, source_field.is_active, _created_by)
    RETURNING id INTO new_field_id;
    INSERT INTO public.base_options (field_id, source_option_id, label, value, description, display_order, is_active)
    SELECT new_field_id, o.id, o.label, o.value, o.description, o.display_order, o.is_active
    FROM public.base_options o WHERE o.field_id = source_field.id ORDER BY o.display_order, o.created_at;
  END LOOP;
END; $function$;

-- 2) Update propagation for options
CREATE OR REPLACE FUNCTION public.propagate_general_option_update()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE src_field record;
BEGIN
  SELECT * INTO src_field FROM public.base_fields WHERE id = NEW.field_id;
  IF src_field.project_id IS NOT NULL THEN RETURN NEW; END IF;
  UPDATE public.base_options po
  SET label = NEW.label, description = NEW.description, value = NEW.value,
      display_order = NEW.display_order, is_active = NEW.is_active
  FROM public.base_fields pf
  WHERE po.field_id = pf.id AND pf.source_field_id = src_field.id
    AND (po.source_option_id = NEW.id OR po.value = NEW.value);
  RETURN NEW;
END; $function$;

DROP TRIGGER IF EXISTS trg_propagate_general_option_update ON public.base_options;
CREATE TRIGGER trg_propagate_general_option_update AFTER UPDATE ON public.base_options
FOR EACH ROW EXECUTE FUNCTION public.propagate_general_option_update();

-- 3) Update propagation for fields
CREATE OR REPLACE FUNCTION public.propagate_general_field_update()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF NEW.project_id IS NOT NULL THEN RETURN NEW; END IF;
  UPDATE public.base_fields
  SET label = NEW.label, section = NEW.section, field_type = NEW.field_type,
      is_required = NEW.is_required, display_order = NEW.display_order,
      allows_multiple = NEW.allows_multiple, allows_free_text = NEW.allows_free_text,
      is_active = NEW.is_active
  WHERE source_field_id = NEW.id;
  RETURN NEW;
END; $function$;

DROP TRIGGER IF EXISTS trg_propagate_general_field_update ON public.base_fields;
CREATE TRIGGER trg_propagate_general_field_update AFTER UPDATE ON public.base_fields
FOR EACH ROW EXECUTE FUNCTION public.propagate_general_field_update();

DROP TRIGGER IF EXISTS trg_propagate_general_option_insert ON public.base_options;
CREATE TRIGGER trg_propagate_general_option_insert AFTER INSERT ON public.base_options
FOR EACH ROW EXECUTE FUNCTION public.propagate_general_option_insert();

DROP TRIGGER IF EXISTS trg_propagate_general_field_insert ON public.base_fields;
CREATE TRIGGER trg_propagate_general_field_insert AFTER INSERT ON public.base_fields
FOR EACH ROW EXECUTE FUNCTION public.propagate_general_field_insert();

-- 4) Backfill: link source_option_id when missing (by value)
UPDATE public.base_options po
SET source_option_id = src.id
FROM public.base_fields pf, public.base_fields gf, public.base_options src
WHERE po.field_id = pf.id
  AND pf.project_id IS NOT NULL
  AND gf.id = pf.source_field_id
  AND src.field_id = gf.id
  AND src.value = po.value
  AND po.source_option_id IS NULL;

-- 5) Backfill descriptions from source
UPDATE public.base_options po
SET description = src.description, label = src.label
FROM public.base_fields pf, public.base_fields gf, public.base_options src
WHERE po.field_id = pf.id
  AND pf.project_id IS NOT NULL
  AND gf.id = pf.source_field_id
  AND (src.id = po.source_option_id OR src.value = po.value)
  AND src.field_id = gf.id
  AND (po.description IS NULL OR po.description = '');
