CREATE TABLE public.project_employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  position_id uuid NOT NULL REFERENCES public.project_positions(id) ON DELETE RESTRICT,
  area_id uuid REFERENCES public.project_areas(id) ON DELETE SET NULL,
  sector_id uuid REFERENCES public.project_areas(id) ON DELETE SET NULL,
  nome text NOT NULL,
  admission_date date NOT NULL,
  last_performance_review_date date,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_employees_nome_not_blank CHECK (length(trim(nome)) > 0),
  CONSTRAINT project_employees_review_after_admission CHECK (
    last_performance_review_date IS NULL
    OR last_performance_review_date >= admission_date
  )
);

CREATE INDEX project_employees_project_idx ON public.project_employees(project_id, nome);
CREATE INDEX project_employees_position_idx ON public.project_employees(project_id, position_id);
CREATE INDEX project_employees_area_sector_idx ON public.project_employees(project_id, area_id, sector_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_employees TO authenticated;
GRANT ALL ON public.project_employees TO service_role;

ALTER TABLE public.project_employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employees read"
  ON public.project_employees FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND (p.responsavel_id = auth.uid() OR p.created_by = auth.uid()))
    OR public.is_project_member(auth.uid(), project_id)
  );

CREATE POLICY "employees insert"
  ON public.project_employees FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_project_base(auth.uid(), project_id));

CREATE POLICY "employees update"
  ON public.project_employees FOR UPDATE TO authenticated
  USING (public.can_manage_project_base(auth.uid(), project_id))
  WITH CHECK (public.can_manage_project_base(auth.uid(), project_id));

CREATE POLICY "employees delete"
  ON public.project_employees FOR DELETE TO authenticated
  USING (public.can_manage_project_base(auth.uid(), project_id));

CREATE TRIGGER trg_project_employees_upd
  BEFORE UPDATE ON public.project_employees
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.validate_project_employee_links()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  linked_project uuid;
  linked_parent uuid;
BEGIN
  SELECT project_id INTO linked_project
  FROM public.project_positions
  WHERE id = NEW.position_id;

  IF linked_project IS NULL OR linked_project <> NEW.project_id THEN
    RAISE EXCEPTION 'O cargo precisa pertencer ao mesmo projeto.';
  END IF;

  IF NEW.area_id IS NOT NULL THEN
    SELECT project_id, parent_id INTO linked_project, linked_parent
    FROM public.project_areas
    WHERE id = NEW.area_id;

    IF linked_project IS NULL OR linked_project <> NEW.project_id OR linked_parent IS NOT NULL THEN
      RAISE EXCEPTION 'A area precisa pertencer ao mesmo projeto.';
    END IF;
  END IF;

  IF NEW.sector_id IS NOT NULL THEN
    IF NEW.area_id IS NULL THEN
      RAISE EXCEPTION 'Selecione uma area antes do setor.';
    END IF;

    SELECT project_id, parent_id INTO linked_project, linked_parent
    FROM public.project_areas
    WHERE id = NEW.sector_id;

    IF linked_project IS NULL OR linked_project <> NEW.project_id THEN
      RAISE EXCEPTION 'O setor precisa pertencer ao mesmo projeto.';
    END IF;

    IF NEW.area_id IS NOT NULL AND linked_parent <> NEW.area_id THEN
      RAISE EXCEPTION 'O setor precisa pertencer a area selecionada.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_project_employees_validate_links
  BEFORE INSERT OR UPDATE OF project_id, position_id, area_id, sector_id ON public.project_employees
  FOR EACH ROW EXECUTE FUNCTION public.validate_project_employee_links();
