CREATE OR REPLACE FUNCTION public.can_create_dc(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL
    AND _project_id IS NOT NULL
    AND (
      public.is_admin(_user_id)
      OR EXISTS (
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
            'gp'::public.project_role,
            'usuario_comum'::public.project_role,
            'lider_superior'::public.project_role,
            'lider_setor'::public.project_role,
            'lider_estrategico'::public.project_role,
            'lider_tatico'::public.project_role,
            'lider_operacional'::public.project_role
          )
      )
    );
$$;

GRANT EXECUTE ON FUNCTION public.can_create_dc(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_create_dc(uuid, uuid) TO service_role;

DROP POLICY IF EXISTS "dc insert" ON public.descricoes_cargo;
CREATE POLICY "dc insert"
ON public.descricoes_cargo
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND etapa = 'em_criacao'::public.dc_stage
  AND public.can_create_dc(auth.uid(), project_id)
);

CREATE OR REPLACE FUNCTION public.can_view_dc(_user_id uuid, _dc_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  dc record;
  member record;
  setor_uuid uuid;
BEGIN
  SELECT * INTO dc FROM public.descricoes_cargo WHERE id = _dc_id;
  IF dc IS NULL THEN RETURN false; END IF;

  IF public.is_admin(_user_id) THEN RETURN true; END IF;

  IF EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = dc.project_id
      AND (p.responsavel_id = _user_id OR p.created_by = _user_id)
  ) THEN
    RETURN true;
  END IF;

  SELECT * INTO member
  FROM public.project_members
  WHERE project_id = dc.project_id AND user_id = _user_id
  LIMIT 1;
  IF member IS NULL THEN RETURN false; END IF;

  -- GP e admin do projeto: acesso total (inclui em_criacao)
  IF member.role::text IN ('gp','admin') THEN RETURN true; END IF;

  -- Usuário comum: apenas as próprias DCs
  IF member.role::text = 'usuario_comum' THEN
    RETURN dc.created_by = _user_id;
  END IF;

  -- Líderes NÃO veem 'em_criacao'
  IF dc.etapa::text = 'em_criacao' THEN
    RETURN false;
  END IF;

  -- lider_superior: vê em_aprovacao e concluido do projeto todo
  IF member.role::text IN ('lider_superior', 'lider_estrategico', 'lider_tatico', 'lider_operacional') THEN RETURN true; END IF;

  -- lider_setor: vê em_aprovacao e concluido apenas quando o setor da DC está no escopo
  IF member.role::text = 'lider_setor' THEN
    BEGIN
      setor_uuid := dc.departamento::uuid;
    EXCEPTION WHEN others THEN
      RETURN false;
    END;
    IF setor_uuid IS NULL THEN RETURN false; END IF;
    RETURN EXISTS (
      SELECT 1 FROM public.project_member_scopes s
      WHERE s.member_id = member.id
        AND s.area_id IN (SELECT public.area_ancestors(setor_uuid))
    );
  END IF;

  RETURN false;
END $function$;

GRANT EXECUTE ON FUNCTION public.can_view_dc(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_dc(uuid, uuid) TO service_role;