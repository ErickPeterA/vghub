CREATE TYPE public.dynamic_field_type AS ENUM ('text', 'textarea', 'number', 'date', 'checkbox', 'single_select', 'multi_select');

CREATE TABLE public.base_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  source_field_id uuid NULL REFERENCES public.base_fields(id) ON DELETE SET NULL,
  field_key text NOT NULL,
  label text NOT NULL,
  section text NOT NULL DEFAULT 'Geral',
  field_type public.dynamic_field_type NOT NULL DEFAULT 'text',
  is_required boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  allows_multiple boolean NOT NULL DEFAULT false,
  allows_free_text boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.base_fields TO authenticated;
GRANT ALL ON public.base_fields TO service_role;
ALTER TABLE public.base_fields ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX base_fields_general_key_unique ON public.base_fields(field_key) WHERE project_id IS NULL;
CREATE UNIQUE INDEX base_fields_project_key_unique ON public.base_fields(project_id, field_key) WHERE project_id IS NOT NULL;
CREATE INDEX base_fields_project_order_idx ON public.base_fields(project_id, display_order);

CREATE TABLE public.base_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id uuid NOT NULL REFERENCES public.base_fields(id) ON DELETE CASCADE,
  source_option_id uuid NULL REFERENCES public.base_options(id) ON DELETE SET NULL,
  label text NOT NULL,
  value text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(field_id, value)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.base_options TO authenticated;
GRANT ALL ON public.base_options TO service_role;
ALTER TABLE public.base_options ENABLE ROW LEVEL SECURITY;
CREATE INDEX base_options_field_order_idx ON public.base_options(field_id, display_order);

ALTER TABLE public.descricoes_cargo ADD COLUMN dynamic_values jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.can_manage_project_base(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin(_user_id)
    OR EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = _project_id AND p.responsavel_id = _user_id
    )
    OR public.get_project_role(_user_id, _project_id) IN ('admin'::public.project_role, 'lider_estrategico'::public.project_role, 'gp'::public.project_role);
$$;

CREATE POLICY "Authenticated users can read general fields"
ON public.base_fields FOR SELECT TO authenticated
USING (project_id IS NULL OR public.is_project_member(auth.uid(), project_id) OR public.is_admin(auth.uid()));
CREATE POLICY "Admins can create general fields"
ON public.base_fields FOR INSERT TO authenticated
WITH CHECK ((project_id IS NULL AND public.is_admin(auth.uid())) OR (project_id IS NOT NULL AND public.can_manage_project_base(auth.uid(), project_id)));
CREATE POLICY "Managers can update available fields"
ON public.base_fields FOR UPDATE TO authenticated
USING ((project_id IS NULL AND public.is_admin(auth.uid())) OR (project_id IS NOT NULL AND public.can_manage_project_base(auth.uid(), project_id)))
WITH CHECK ((project_id IS NULL AND public.is_admin(auth.uid())) OR (project_id IS NOT NULL AND public.can_manage_project_base(auth.uid(), project_id)));
CREATE POLICY "Managers can delete available fields"
ON public.base_fields FOR DELETE TO authenticated
USING ((project_id IS NULL AND public.is_admin(auth.uid())) OR (project_id IS NOT NULL AND public.can_manage_project_base(auth.uid(), project_id)));

CREATE POLICY "Users can read available options"
ON public.base_options FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.base_fields f
  WHERE f.id = field_id
    AND (f.project_id IS NULL OR public.is_project_member(auth.uid(), f.project_id) OR public.is_admin(auth.uid()))
));
CREATE POLICY "Managers can create options"
ON public.base_options FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.base_fields f
  WHERE f.id = field_id
    AND ((f.project_id IS NULL AND public.is_admin(auth.uid())) OR (f.project_id IS NOT NULL AND public.can_manage_project_base(auth.uid(), f.project_id)))
));
CREATE POLICY "Managers can update options"
ON public.base_options FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.base_fields f
  WHERE f.id = field_id
    AND ((f.project_id IS NULL AND public.is_admin(auth.uid())) OR (f.project_id IS NOT NULL AND public.can_manage_project_base(auth.uid(), f.project_id)))
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.base_fields f
  WHERE f.id = field_id
    AND ((f.project_id IS NULL AND public.is_admin(auth.uid())) OR (f.project_id IS NOT NULL AND public.can_manage_project_base(auth.uid(), f.project_id)))
));
CREATE POLICY "Managers can delete options"
ON public.base_options FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.base_fields f
  WHERE f.id = field_id
    AND ((f.project_id IS NULL AND public.is_admin(auth.uid())) OR (f.project_id IS NOT NULL AND public.can_manage_project_base(auth.uid(), f.project_id)))
));

CREATE TRIGGER set_base_fields_updated_at BEFORE UPDATE ON public.base_fields
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_base_options_updated_at BEFORE UPDATE ON public.base_options
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

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
  IF EXISTS (SELECT 1 FROM public.base_fields WHERE project_id = _project_id) THEN
    RETURN;
  END IF;

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
END;
$$;

CREATE OR REPLACE FUNCTION public.clone_base_on_project_create()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.clone_general_base_to_project(NEW.id, NEW.created_by);
  RETURN NEW;
END;
$$;
CREATE TRIGGER clone_base_after_project_create
AFTER INSERT ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.clone_base_on_project_create();

CREATE OR REPLACE FUNCTION public.log_base_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_project_id uuid;
  target_id uuid;
  action_name text;
BEGIN
  IF TG_TABLE_NAME = 'base_fields' THEN
    target_project_id := COALESCE(NEW.project_id, OLD.project_id);
    target_id := COALESCE(NEW.id, OLD.id);
  ELSE
    SELECT project_id INTO target_project_id
    FROM public.base_fields
    WHERE id = COALESCE(NEW.field_id, OLD.field_id);
    target_id := COALESCE(NEW.id, OLD.id);
  END IF;

  IF target_project_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  action_name := CASE TG_OP WHEN 'INSERT' THEN 'base_item_criado' WHEN 'UPDATE' THEN 'base_item_atualizado' ELSE 'base_item_excluido' END;
  INSERT INTO public.project_history(project_id, user_id, acao, entidade, entidade_id, detalhes)
  VALUES (target_project_id, auth.uid(), action_name, TG_TABLE_NAME, target_id, jsonb_build_object('operacao', TG_OP));
  RETURN COALESCE(NEW, OLD);
END;
$$;
CREATE TRIGGER log_base_fields_change AFTER INSERT OR UPDATE OR DELETE ON public.base_fields
FOR EACH ROW EXECUTE FUNCTION public.log_base_change();
CREATE TRIGGER log_base_options_change AFTER INSERT OR UPDATE OR DELETE ON public.base_options
FOR EACH ROW EXECUTE FUNCTION public.log_base_change();

WITH seed(field_key, label, section, field_type, is_required, display_order, allows_multiple, allows_free_text) AS (
  VALUES
    ('cargo', 'Cargo', 'Cabeçalho', 'text'::public.dynamic_field_type, true, 10, false, true),
    ('unidade_negocio', 'Unidade de negócio', 'Cabeçalho', 'single_select'::public.dynamic_field_type, false, 20, false, true),
    ('departamento', 'Departamento', 'Cabeçalho', 'single_select'::public.dynamic_field_type, false, 30, false, true),
    ('nivelamento', 'Nivelamento', 'Cabeçalho', 'single_select'::public.dynamic_field_type, false, 40, false, true),
    ('superior_imediato', 'Superior imediato', 'Cabeçalho', 'text'::public.dynamic_field_type, false, 50, false, true),
    ('tipo_carreira', 'Tipo de carreira', 'Cabeçalho', 'single_select'::public.dynamic_field_type, false, 60, false, true),
    ('data_versao', 'Data da versão', 'Cabeçalho', 'date'::public.dynamic_field_type, false, 70, false, false),
    ('data_revisao', 'Última revisão', 'Cabeçalho', 'date'::public.dynamic_field_type, false, 80, false, false),
    ('status', 'Status', 'Cabeçalho', 'single_select'::public.dynamic_field_type, true, 90, false, false),
    ('objetivo', 'Objetivo do cargo', 'Cabeçalho', 'textarea'::public.dynamic_field_type, false, 100, false, true),
    ('escolaridade', 'Escolaridade', 'Instrução', 'multi_select'::public.dynamic_field_type, false, 110, true, true),
    ('conhecimentos', 'Conhecimentos', 'Conhecimento', 'multi_select'::public.dynamic_field_type, false, 120, true, true),
    ('competencias', 'Competências', 'Habilidades', 'multi_select'::public.dynamic_field_type, false, 130, true, true)
)
INSERT INTO public.base_fields(field_key, label, section, field_type, is_required, display_order, allows_multiple, allows_free_text)
SELECT * FROM seed
ON CONFLICT DO NOTHING;

INSERT INTO public.base_options(field_id, label, value, display_order)
SELECT f.id, v.label, v.value, v.ord
FROM public.base_fields f
JOIN (VALUES
  ('departamento','Financeiro','financeiro',10), ('departamento','Comercial','comercial',20), ('departamento','RH','rh',30), ('departamento','Jurídico','juridico',40), ('departamento','Operação','operacao',50),
  ('unidade_negocio','Matriz','matriz',10), ('unidade_negocio','Filial','filial',20), ('unidade_negocio','Agência','agencia',30),
  ('escolaridade','Ensino Médio','ensino_medio',10), ('escolaridade','Superior','superior',20), ('escolaridade','Pós-graduação','pos_graduacao',30),
  ('conhecimentos','Excel','excel',10), ('conhecimentos','Power BI','power_bi',20), ('conhecimentos','Legislação Trabalhista','legislacao_trabalhista',30),
  ('competencias','Liderança','lideranca',10), ('competencias','Comunicação','comunicacao',20), ('competencias','Organização','organizacao',30),
  ('nivelamento','Júnior','junior',10), ('nivelamento','Pleno','pleno',20), ('nivelamento','Sênior','senior',30),
  ('tipo_carreira','Especialista','especialista',10), ('tipo_carreira','Gestão','gestao',20),
  ('status','Rascunho','rascunho',10), ('status','Em revisão','em_revisao',20), ('status','Aprovado','aprovado',30), ('status','Arquivado','arquivado',40)
) AS v(field_key,label,value,ord) ON v.field_key = f.field_key
WHERE f.project_id IS NULL
ON CONFLICT DO NOTHING;

DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT id, created_by FROM public.projects LOOP
    PERFORM public.clone_general_base_to_project(p.id, p.created_by);
  END LOOP;
END;
$$;