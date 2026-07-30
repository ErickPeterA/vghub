-- Corrige o bug relatado: um líder com escopo de área ainda conseguia
-- acessar um projeto desativado. Isso acontecia porque as descrições de
-- cargo (e a Base do projeto) não passam pela função is_project_member —
-- elas usam funções próprias (can_view_dc_row, can_create_dc,
-- can_manage_project_base) que checavam papel/responsável sem nunca olhar
-- para o status do projeto. Esta migração adiciona a checagem de status
-- nessas funções também, para que a regra "só GP e admin acessam projeto
-- desativado" valha em todo lugar.

-- 1) Visualização/edição de descrição de cargo
CREATE OR REPLACE FUNCTION public.can_view_dc_row(
  _user_id uuid,
  _project_id uuid,
  _created_by uuid,
  _etapa public.dc_stage,
  _departamento text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  member record;
  proj record;
  setor_uuid uuid;
BEGIN
  IF _user_id IS NULL OR _project_id IS NULL THEN
    RETURN false;
  END IF;

  IF public.is_admin(_user_id) THEN
    RETURN true;
  END IF;

  SELECT * INTO proj FROM public.projects p WHERE p.id = _project_id;
  IF proj IS NULL THEN
    RETURN false;
  END IF;

  SELECT * INTO member
  FROM public.project_members
  WHERE project_id = _project_id AND user_id = _user_id
  LIMIT 1;

  -- GP mantém acesso total mesmo com o projeto desativado
  IF member IS NOT NULL AND member.role::text = 'gp' THEN
    RETURN true;
  END IF;

  -- Projeto desativado: ninguém além de admin/gp (checados acima) passa daqui
  IF proj.status = 'desativado'::public.project_status THEN
    RETURN false;
  END IF;

  IF proj.responsavel_id = _user_id OR proj.created_by = _user_id THEN
    RETURN true;
  END IF;

  IF member IS NULL THEN
    RETURN false;
  END IF;

  IF member.role::text = 'admin' THEN
    RETURN true;
  END IF;

  IF member.role::text = 'usuario_comum' THEN
    RETURN _created_by = _user_id;
  END IF;

  IF _etapa::text = 'em_criacao' THEN
    RETURN false;
  END IF;

  IF member.role::text IN ('lider_superior', 'lider_estrategico', 'lider_tatico', 'lider_operacional') THEN
    RETURN true;
  END IF;

  IF member.role::text = 'lider_setor' THEN
    BEGIN
      setor_uuid := NULLIF(_departamento, '')::uuid;
    EXCEPTION WHEN others THEN
      RETURN false;
    END;

    IF setor_uuid IS NULL THEN
      RETURN false;
    END IF;

    RETURN EXISTS (
      SELECT 1
      FROM public.project_member_scopes s
      WHERE s.member_id = member.id
        AND s.area_id IN (SELECT public.area_ancestors(setor_uuid))
    );
  END IF;

  RETURN false;
END;
$function$;

-- 2) Criação de novas descrições de cargo
CREATE OR REPLACE FUNCTION public.can_create_dc(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  proj record;
BEGIN
  IF _user_id IS NULL OR _project_id IS NULL THEN
    RETURN false;
  END IF;

  IF public.is_admin(_user_id) THEN
    RETURN true;
  END IF;

  SELECT * INTO proj FROM public.projects p WHERE p.id = _project_id;
  IF proj IS NULL THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = _project_id AND pm.user_id = _user_id AND pm.role = 'gp'::public.project_role
  ) THEN
    RETURN true;
  END IF;

  IF proj.status = 'desativado'::public.project_status THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = _project_id
      AND (p.created_by = _user_id OR p.responsavel_id = _user_id)
  )
  OR EXISTS (
    SELECT 1
    FROM public.project_members pm
    WHERE pm.project_id = _project_id
      AND pm.user_id = _user_id
      AND pm.role IN (
        'admin'::public.project_role,
        'usuario_comum'::public.project_role,
        'lider_superior'::public.project_role,
        'lider_setor'::public.project_role,
        'lider_estrategico'::public.project_role,
        'lider_tatico'::public.project_role,
        'lider_operacional'::public.project_role
      )
  );
END;
$$;

-- 3) Gestão da Base do projeto (campos/opções/limites de bloco)
CREATE OR REPLACE FUNCTION public.can_manage_project_base(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  proj record;
BEGIN
  IF public.is_admin(_user_id) THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = _project_id AND pm.user_id = _user_id AND pm.role = 'gp'::public.project_role
  ) THEN
    RETURN true;
  END IF;

  SELECT * INTO proj FROM public.projects p WHERE p.id = _project_id;
  IF proj IS NULL OR proj.status = 'desativado'::public.project_status THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.projects p WHERE p.id = _project_id AND p.responsavel_id = _user_id
  )
  OR public.get_project_role(_user_id, _project_id) IN ('admin'::public.project_role, 'lider_estrategico'::public.project_role);
END;
$$;

-- 4) Exclusão de descrição de cargo
CREATE OR REPLACE FUNCTION public.can_delete_dc(_user_id uuid, _project_id uuid, _created_by uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  proj record;
BEGIN
  IF public.is_admin(_user_id) THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = _project_id AND pm.user_id = _user_id AND pm.role = 'gp'::public.project_role
  ) THEN
    RETURN true;
  END IF;

  SELECT * INTO proj FROM public.projects p WHERE p.id = _project_id;
  IF proj IS NULL OR proj.status = 'desativado'::public.project_status THEN
    RETURN false;
  END IF;

  RETURN proj.responsavel_id = _user_id OR _created_by = _user_id;
END;
$$;

DROP POLICY IF EXISTS "dc delete" ON public.descricoes_cargo;
CREATE POLICY "dc delete" ON public.descricoes_cargo FOR DELETE TO authenticated
  USING (public.can_delete_dc(auth.uid(), project_id, created_by));