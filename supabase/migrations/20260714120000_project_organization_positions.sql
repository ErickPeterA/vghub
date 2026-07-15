DO $$ BEGIN
  CREATE TYPE public.organization_position_status AS ENUM ('active', 'inactive');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.project_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.project_positions(id) ON DELETE SET NULL,
  nome text NOT NULL,
  descricao text,
  display_order integer NOT NULL DEFAULT 0,
  status public.organization_position_status NOT NULL DEFAULT 'active',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_positions_nome_not_blank CHECK (length(trim(nome)) > 0)
);

CREATE INDEX project_positions_project_idx ON public.project_positions(project_id);
CREATE INDEX project_positions_parent_idx ON public.project_positions(parent_id);
CREATE INDEX project_positions_project_parent_idx ON public.project_positions(project_id, parent_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_positions TO authenticated;
GRANT ALL ON public.project_positions TO service_role;

ALTER TABLE public.project_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "positions read"
  ON public.project_positions FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND (p.responsavel_id = auth.uid() OR p.created_by = auth.uid()))
    OR public.is_project_member(auth.uid(), project_id)
  );

CREATE POLICY "positions insert"
  ON public.project_positions FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_project_base(auth.uid(), project_id));

CREATE POLICY "positions update"
  ON public.project_positions FOR UPDATE TO authenticated
  USING (public.can_manage_project_base(auth.uid(), project_id))
  WITH CHECK (public.can_manage_project_base(auth.uid(), project_id));

CREATE POLICY "positions delete"
  ON public.project_positions FOR DELETE TO authenticated
  USING (public.can_manage_project_base(auth.uid(), project_id));

CREATE TRIGGER trg_project_positions_upd
  BEFORE UPDATE ON public.project_positions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.project_position_is_descendant(_ancestor_id uuid, _candidate_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE descendants AS (
    SELECT id FROM public.project_positions WHERE parent_id = _ancestor_id
    UNION ALL
    SELECT p.id
    FROM public.project_positions p
    JOIN descendants d ON p.parent_id = d.id
  )
  SELECT EXISTS (SELECT 1 FROM descendants WHERE id = _candidate_id);
$$;

CREATE OR REPLACE FUNCTION public.validate_project_position_parent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  parent_project uuid;
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.parent_id = NEW.id THEN
    RAISE EXCEPTION 'Um cargo não pode ser superior dele mesmo.';
  END IF;

  SELECT project_id INTO parent_project FROM public.project_positions WHERE id = NEW.parent_id;
  IF parent_project IS NULL OR parent_project <> NEW.project_id THEN
    RAISE EXCEPTION 'O superior imediato precisa pertencer ao mesmo projeto.';
  END IF;

  IF TG_OP = 'UPDATE' AND public.project_position_is_descendant(NEW.id, NEW.parent_id) THEN
    RAISE EXCEPTION 'Não é permitido criar ciclo na hierarquia.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_project_positions_validate_parent
  BEFORE INSERT OR UPDATE OF parent_id, project_id ON public.project_positions
  FOR EACH ROW EXECUTE FUNCTION public.validate_project_position_parent();

CREATE OR REPLACE FUNCTION public.move_project_position(_position_id uuid, _new_parent_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_project uuid;
  next_order integer;
BEGIN
  SELECT project_id INTO current_project FROM public.project_positions WHERE id = _position_id;
  IF current_project IS NULL THEN
    RAISE EXCEPTION 'Cargo não encontrado.';
  END IF;
  IF NOT public.can_manage_project_base(auth.uid(), current_project) THEN
    RAISE EXCEPTION 'Sem permissão para alterar este organograma.';
  END IF;
  IF _new_parent_id = _position_id THEN
    RAISE EXCEPTION 'Um cargo não pode ser superior dele mesmo.';
  END IF;
  IF _new_parent_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.project_positions WHERE id = _new_parent_id AND project_id = current_project) THEN
      RAISE EXCEPTION 'Superior imediato inválido.';
    END IF;
    IF public.project_position_is_descendant(_position_id, _new_parent_id) THEN
      RAISE EXCEPTION 'Não é permitido mover um cargo para baixo de um subordinado.';
    END IF;
  END IF;

  SELECT COALESCE(MAX(display_order), 0) + 10 INTO next_order
  FROM public.project_positions
  WHERE project_id = current_project AND parent_id IS NOT DISTINCT FROM _new_parent_id;

  UPDATE public.project_positions
  SET parent_id = _new_parent_id, display_order = next_order
  WHERE id = _position_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.insert_project_position_above(_target_id uuid, _nome text, _descricao text DEFAULT NULL, _status public.organization_position_status DEFAULT 'active')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_row public.project_positions%ROWTYPE;
  new_id uuid;
BEGIN
  SELECT * INTO target_row FROM public.project_positions WHERE id = _target_id;
  IF target_row.id IS NULL THEN
    RAISE EXCEPTION 'Cargo não encontrado.';
  END IF;
  IF NOT public.can_manage_project_base(auth.uid(), target_row.project_id) THEN
    RAISE EXCEPTION 'Sem permissão para alterar este organograma.';
  END IF;
  IF length(trim(COALESCE(_nome, ''))) = 0 THEN
    RAISE EXCEPTION 'Nome do cargo é obrigatório.';
  END IF;

  INSERT INTO public.project_positions(project_id, parent_id, nome, descricao, display_order, status, created_by)
  VALUES (target_row.project_id, target_row.parent_id, trim(_nome), NULLIF(trim(COALESCE(_descricao, '')), ''), target_row.display_order, _status, auth.uid())
  RETURNING id INTO new_id;

  UPDATE public.project_positions
  SET parent_id = new_id, display_order = 10
  WHERE id = target_row.id;

  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_project_position_with_reassignment(_position_id uuid, _children_parent_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_row public.project_positions%ROWTYPE;
  child record;
  next_order integer;
BEGIN
  SELECT * INTO target_row FROM public.project_positions WHERE id = _position_id;
  IF target_row.id IS NULL THEN
    RAISE EXCEPTION 'Cargo não encontrado.';
  END IF;
  IF NOT public.can_manage_project_base(auth.uid(), target_row.project_id) THEN
    RAISE EXCEPTION 'Sem permissão para excluir este cargo.';
  END IF;
  IF _children_parent_id = _position_id THEN
    RAISE EXCEPTION 'Destino inválido para subordinados.';
  END IF;
  IF _children_parent_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.project_positions WHERE id = _children_parent_id AND project_id = target_row.project_id
  ) THEN
    RAISE EXCEPTION 'Superior escolhido inválido.';
  END IF;
  IF _children_parent_id IS NOT NULL AND public.project_position_is_descendant(_position_id, _children_parent_id) THEN
    RAISE EXCEPTION 'Não é permitido repassar subordinados para dentro da própria estrutura excluída.';
  END IF;

  SELECT COALESCE(MAX(display_order), 0) INTO next_order
  FROM public.project_positions
  WHERE project_id = target_row.project_id AND parent_id IS NOT DISTINCT FROM _children_parent_id;

  FOR child IN SELECT id FROM public.project_positions WHERE parent_id = _position_id ORDER BY display_order, created_at LOOP
    next_order := next_order + 10;
    UPDATE public.project_positions SET parent_id = _children_parent_id, display_order = next_order WHERE id = child.id;
  END LOOP;

  DELETE FROM public.project_positions WHERE id = _position_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reorder_project_position(_position_id uuid, _direction text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_row public.project_positions%ROWTYPE;
  swap_row public.project_positions%ROWTYPE;
BEGIN
  SELECT * INTO current_row FROM public.project_positions WHERE id = _position_id;
  IF current_row.id IS NULL THEN
    RAISE EXCEPTION 'Cargo não encontrado.';
  END IF;
  IF NOT public.can_manage_project_base(auth.uid(), current_row.project_id) THEN
    RAISE EXCEPTION 'Sem permissão para reordenar este organograma.';
  END IF;

  IF _direction = 'up' THEN
    SELECT * INTO swap_row
    FROM public.project_positions
    WHERE project_id = current_row.project_id
      AND parent_id IS NOT DISTINCT FROM current_row.parent_id
      AND (display_order, created_at, id) < (current_row.display_order, current_row.created_at, current_row.id)
    ORDER BY display_order DESC, created_at DESC, id DESC
    LIMIT 1;
  ELSIF _direction = 'down' THEN
    SELECT * INTO swap_row
    FROM public.project_positions
    WHERE project_id = current_row.project_id
      AND parent_id IS NOT DISTINCT FROM current_row.parent_id
      AND (display_order, created_at, id) > (current_row.display_order, current_row.created_at, current_row.id)
    ORDER BY display_order ASC, created_at ASC, id ASC
    LIMIT 1;
  ELSE
    RAISE EXCEPTION 'Direção inválida.';
  END IF;

  IF swap_row.id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.project_positions SET display_order = swap_row.display_order WHERE id = current_row.id;
  UPDATE public.project_positions SET display_order = current_row.display_order WHERE id = swap_row.id;
END;
$$;
