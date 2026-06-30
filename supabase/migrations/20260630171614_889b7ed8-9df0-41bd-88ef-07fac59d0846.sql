
-- 1) Tabela project_areas
CREATE TABLE public.project_areas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.project_areas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  cor text,
  display_order integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX project_areas_project_idx ON public.project_areas(project_id);
CREATE INDEX project_areas_parent_idx ON public.project_areas(parent_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_areas TO authenticated;
GRANT ALL ON public.project_areas TO service_role;

ALTER TABLE public.project_areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "areas read" ON public.project_areas FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_project_member(auth.uid(), project_id));

CREATE POLICY "areas insert" ON public.project_areas FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.responsavel_id = auth.uid())
  );

CREATE POLICY "areas update" ON public.project_areas FOR UPDATE TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.responsavel_id = auth.uid())
  );

CREATE POLICY "areas delete" ON public.project_areas FOR DELETE TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.responsavel_id = auth.uid())
  );

CREATE TRIGGER trg_project_areas_upd BEFORE UPDATE ON public.project_areas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) data_source em base_fields
ALTER TABLE public.base_fields ADD COLUMN data_source text NOT NULL DEFAULT 'manual';
-- aceita: 'manual' | 'areas' | 'setores'

-- 3) Atualizar campos da Base Geral
UPDATE public.base_fields
SET label = 'Área', field_type = 'single_select', data_source = 'areas'
WHERE project_id IS NULL AND field_key = 'unidade_negocio';

UPDATE public.base_fields
SET label = 'Setor', field_type = 'single_select', data_source = 'setores'
WHERE project_id IS NULL AND field_key = 'departamento';

-- Propagar para projetos
UPDATE public.base_fields p
SET label = g.label, field_type = g.field_type, data_source = g.data_source
FROM public.base_fields g
WHERE p.source_field_id = g.id
  AND g.project_id IS NULL
  AND g.field_key IN ('unidade_negocio','departamento');

-- 4) Backfill: criar Áreas e Setores a partir de DCs existentes
DO $$
DECLARE
  proj record;
  area_text text;
  setor_text text;
  area_id uuid;
  setor_id uuid;
BEGIN
  FOR proj IN SELECT id FROM public.projects LOOP
    -- Áreas únicas
    FOR area_text IN
      SELECT DISTINCT trim(unidade_negocio)
      FROM public.descricoes_cargo
      WHERE project_id = proj.id AND unidade_negocio IS NOT NULL AND trim(unidade_negocio) <> ''
    LOOP
      INSERT INTO public.project_areas(project_id, nome) VALUES (proj.id, area_text)
      RETURNING id INTO area_id;
      -- Atualiza DCs para guardar o uuid
      UPDATE public.descricoes_cargo SET unidade_negocio = area_id::text
      WHERE project_id = proj.id AND trim(unidade_negocio) = area_text;
    END LOOP;

    -- Setores: criar como filhos de uma área "Sem área" se não houver associação clara
    FOR setor_text IN
      SELECT DISTINCT trim(departamento)
      FROM public.descricoes_cargo
      WHERE project_id = proj.id AND departamento IS NOT NULL AND trim(departamento) <> ''
    LOOP
      -- tenta achar uma área qualquer do projeto para parent, senão cria "Geral"
      SELECT id INTO area_id FROM public.project_areas
       WHERE project_id = proj.id AND parent_id IS NULL LIMIT 1;
      IF area_id IS NULL THEN
        INSERT INTO public.project_areas(project_id, nome) VALUES (proj.id, 'Geral')
        RETURNING id INTO area_id;
      END IF;
      INSERT INTO public.project_areas(project_id, parent_id, nome)
      VALUES (proj.id, area_id, setor_text)
      RETURNING id INTO setor_id;
      UPDATE public.descricoes_cargo SET departamento = setor_id::text
      WHERE project_id = proj.id AND trim(departamento) = setor_text;
    END LOOP;
  END LOOP;
END $$;
