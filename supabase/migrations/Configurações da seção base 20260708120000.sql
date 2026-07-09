-- Limite de itens por bloco (repeater) configurado na Base (geral ou por projeto).
-- Segue o mesmo padrão de base_fields: project_id NULL = Base Geral, project_id setado = Base do Projeto.

CREATE TABLE public.base_section_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  section text NOT NULL,
  max_items integer NOT NULL DEFAULT 3,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT base_section_settings_max_items_check CHECK (max_items >= 1)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.base_section_settings TO authenticated;
GRANT ALL ON public.base_section_settings TO service_role;
ALTER TABLE public.base_section_settings ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX base_section_settings_general_unique ON public.base_section_settings(section) WHERE project_id IS NULL;
CREATE UNIQUE INDEX base_section_settings_project_unique ON public.base_section_settings(project_id, section) WHERE project_id IS NOT NULL;

CREATE POLICY "Authenticated users can read section settings"
ON public.base_section_settings FOR SELECT TO authenticated
USING (project_id IS NULL OR public.is_project_member(auth.uid(), project_id) OR public.is_admin(auth.uid()));

CREATE POLICY "Managers can create section settings"
ON public.base_section_settings FOR INSERT TO authenticated
WITH CHECK ((project_id IS NULL AND public.is_admin(auth.uid())) OR (project_id IS NOT NULL AND public.can_manage_project_base(auth.uid(), project_id)));

CREATE POLICY "Managers can update section settings"
ON public.base_section_settings FOR UPDATE TO authenticated
USING ((project_id IS NULL AND public.is_admin(auth.uid())) OR (project_id IS NOT NULL AND public.can_manage_project_base(auth.uid(), project_id)))
WITH CHECK ((project_id IS NULL AND public.is_admin(auth.uid())) OR (project_id IS NOT NULL AND public.can_manage_project_base(auth.uid(), project_id)));

CREATE POLICY "Managers can delete section settings"
ON public.base_section_settings FOR DELETE TO authenticated
USING ((project_id IS NULL AND public.is_admin(auth.uid())) OR (project_id IS NOT NULL AND public.can_manage_project_base(auth.uid(), project_id)));

CREATE TRIGGER set_base_section_settings_updated_at BEFORE UPDATE ON public.base_section_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Estende o clone da Base Geral -> Base do Projeto para também copiar os limites de itens.
CREATE OR REPLACE FUNCTION public.clone_general_base_to_project(_project_id uuid, _created_by uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
        is_required, display_order, allows_multiple, allows_free_text, is_active, created_by
      ) VALUES (
        _project_id, source_field.id, source_field.field_key, source_field.label, source_field.section, source_field.field_type,
        source_field.is_required, source_field.display_order, source_field.allows_multiple, source_field.allows_free_text, source_field.is_active, _created_by
      ) RETURNING id INTO new_field_id;

      INSERT INTO public.base_options (field_id, source_option_id, label, value, display_order, is_active)
      SELECT new_field_id, o.id, o.label, o.value, o.display_order, o.is_active
      FROM public.base_options o
      WHERE o.field_id = source_field.id
      ORDER BY o.display_order, o.created_at;
    END LOOP;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.base_section_settings WHERE project_id = _project_id) THEN
    INSERT INTO public.base_section_settings (project_id, section, max_items, created_by)
    SELECT _project_id, s.section, s.max_items, _created_by
    FROM public.base_section_settings s
    WHERE s.project_id IS NULL;
  END IF;
END;
$$;