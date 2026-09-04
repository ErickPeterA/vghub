-- Fix project fields with wrong data_source and ensure propagation includes data_source
UPDATE public.base_fields pf
SET data_source = src.data_source
FROM public.base_fields src
WHERE pf.source_field_id = src.id
  AND src.project_id IS NULL
  AND pf.data_source IS DISTINCT FROM src.data_source;

CREATE OR REPLACE FUNCTION public.propagate_general_field_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.project_id IS NOT NULL THEN RETURN NEW; END IF;
  UPDATE public.base_fields
  SET label = NEW.label, section = NEW.section, field_type = NEW.field_type,
      is_required = NEW.is_required, display_order = NEW.display_order,
      allows_multiple = NEW.allows_multiple, allows_free_text = NEW.allows_free_text,
      data_source = NEW.data_source,
      is_active = NEW.is_active
  WHERE source_field_id = NEW.id;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.clone_general_base_to_project(_project_id uuid, _created_by uuid DEFAULT NULL::uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE source_field record; new_field_id uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.base_fields WHERE project_id = _project_id) THEN RETURN; END IF;
  FOR source_field IN SELECT * FROM public.base_fields WHERE project_id IS NULL ORDER BY display_order, created_at LOOP
    INSERT INTO public.base_fields (project_id, source_field_id, field_key, label, section, field_type, is_required, display_order, allows_multiple, allows_free_text, data_source, is_active, created_by)
    VALUES (_project_id, source_field.id, source_field.field_key, source_field.label, source_field.section, source_field.field_type, source_field.is_required, source_field.display_order, source_field.allows_multiple, source_field.allows_free_text, source_field.data_source, source_field.is_active, _created_by)
    RETURNING id INTO new_field_id;
    INSERT INTO public.base_options (field_id, source_option_id, label, value, description, display_order, is_active)
    SELECT new_field_id, o.id, o.label, o.value, o.description, o.display_order, o.is_active
    FROM public.base_options o WHERE o.field_id = source_field.id ORDER BY o.display_order, o.created_at;
  END LOOP;
END; $function$;

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
        NEW.is_required, NEW.display_order, NEW.allows_multiple, NEW.allows_free_text, NEW.data_source, NEW.is_active, p.created_by
      ) RETURNING id INTO new_id;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$function$;