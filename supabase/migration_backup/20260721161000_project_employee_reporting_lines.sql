ALTER TABLE public.project_employees
  ADD COLUMN IF NOT EXISTS superior_imediato_id uuid REFERENCES public.project_employees(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS project_employees_superior_idx
  ON public.project_employees(project_id, superior_imediato_id);

CREATE OR REPLACE FUNCTION public.validate_project_employee_links()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  linked_project uuid;
  linked_parent uuid;
  has_cycle boolean;
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

    IF linked_parent <> NEW.area_id THEN
      RAISE EXCEPTION 'O setor precisa pertencer a area selecionada.';
    END IF;
  END IF;

  IF NEW.superior_imediato_id IS NOT NULL THEN
    IF NEW.superior_imediato_id = NEW.id THEN
      RAISE EXCEPTION 'Um funcionario nao pode responder para ele mesmo.';
    END IF;

    SELECT project_id INTO linked_project
    FROM public.project_employees
    WHERE id = NEW.superior_imediato_id;

    IF linked_project IS NULL OR linked_project <> NEW.project_id THEN
      RAISE EXCEPTION 'O superior imediato precisa pertencer ao mesmo projeto.';
    END IF;

    WITH RECURSIVE hierarchy AS (
      SELECT id, superior_imediato_id
      FROM public.project_employees
      WHERE id = NEW.superior_imediato_id
      UNION ALL
      SELECT employee.id, employee.superior_imediato_id
      FROM public.project_employees employee
      JOIN hierarchy parent ON employee.id = parent.superior_imediato_id
    )
    SELECT EXISTS (SELECT 1 FROM hierarchy WHERE id = NEW.id)
    INTO has_cycle;

    IF has_cycle THEN
      RAISE EXCEPTION 'A hierarquia de funcionarios nao pode formar um ciclo.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_employees_validate_links ON public.project_employees;

CREATE TRIGGER trg_project_employees_validate_links
  BEFORE INSERT OR UPDATE OF project_id, position_id, area_id, sector_id, superior_imediato_id ON public.project_employees
  FOR EACH ROW EXECUTE FUNCTION public.validate_project_employee_links();
