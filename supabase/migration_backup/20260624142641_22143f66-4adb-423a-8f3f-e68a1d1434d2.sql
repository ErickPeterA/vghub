
-- 1. Add new field type to enum
ALTER TYPE public.dynamic_field_type ADD VALUE IF NOT EXISTS 'competency_description';

-- 2. Add description column to options (used by competency_description type)
ALTER TABLE public.base_options ADD COLUMN IF NOT EXISTS description text;

-- 3. Trigger: when a new field is inserted into the General Base, clone it into every existing project
CREATE OR REPLACE FUNCTION public.propagate_general_field_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
        is_required, display_order, allows_multiple, allows_free_text, is_active, created_by
      ) VALUES (
        p.id, NEW.id, NEW.field_key, NEW.label, NEW.section, NEW.field_type,
        NEW.is_required, NEW.display_order, NEW.allows_multiple, NEW.allows_free_text, NEW.is_active, p.created_by
      ) RETURNING id INTO new_id;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS propagate_general_field_insert_trg ON public.base_fields;
CREATE TRIGGER propagate_general_field_insert_trg
AFTER INSERT ON public.base_fields
FOR EACH ROW EXECUTE FUNCTION public.propagate_general_field_insert();

-- 4. Trigger: when a new option is inserted into a General Base field, clone it into the matching project copies
CREATE OR REPLACE FUNCTION public.propagate_general_option_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  src_field record;
  proj_field record;
BEGIN
  SELECT * INTO src_field FROM public.base_fields WHERE id = NEW.field_id;
  IF src_field.project_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  FOR proj_field IN
    SELECT id FROM public.base_fields WHERE source_field_id = src_field.id
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.base_options
      WHERE field_id = proj_field.id AND (source_option_id = NEW.id OR value = NEW.value)
    ) THEN
      INSERT INTO public.base_options (field_id, source_option_id, label, value, description, display_order, is_active)
      VALUES (proj_field.id, NEW.id, NEW.label, NEW.value, NEW.description, NEW.display_order, NEW.is_active);
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS propagate_general_option_insert_trg ON public.base_options;
CREATE TRIGGER propagate_general_option_insert_trg
AFTER INSERT ON public.base_options
FOR EACH ROW EXECUTE FUNCTION public.propagate_general_option_insert();
