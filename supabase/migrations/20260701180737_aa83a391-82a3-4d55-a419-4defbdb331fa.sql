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
  setor_uuid uuid;
BEGIN
  IF _user_id IS NULL OR _project_id IS NULL THEN
    RETURN false;
  END IF;

  IF public.is_admin(_user_id) THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = _project_id
      AND (p.responsavel_id = _user_id OR p.created_by = _user_id)
  ) THEN
    RETURN true;
  END IF;

  SELECT * INTO member
  FROM public.project_members
  WHERE project_id = _project_id AND user_id = _user_id
  LIMIT 1;

  IF member IS NULL THEN
    RETURN false;
  END IF;

  IF member.role::text IN ('gp', 'admin') THEN
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

GRANT EXECUTE ON FUNCTION public.can_view_dc_row(uuid, uuid, uuid, public.dc_stage, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_dc_row(uuid, uuid, uuid, public.dc_stage, text) TO service_role;

DROP POLICY IF EXISTS "dc read" ON public.descricoes_cargo;
CREATE POLICY "dc read"
ON public.descricoes_cargo
FOR SELECT
TO authenticated
USING (
  public.can_view_dc_row(auth.uid(), project_id, created_by, etapa, departamento)
);

DROP POLICY IF EXISTS "dc update" ON public.descricoes_cargo;
CREATE POLICY "dc update"
ON public.descricoes_cargo
FOR UPDATE
TO authenticated
USING (
  public.can_view_dc_row(auth.uid(), project_id, created_by, etapa, departamento)
)
WITH CHECK (
  public.can_view_dc_row(auth.uid(), project_id, created_by, etapa, departamento)
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
BEGIN
  SELECT project_id, created_by, etapa, departamento
  INTO dc
  FROM public.descricoes_cargo
  WHERE id = _dc_id;

  IF dc IS NULL THEN
    RETURN false;
  END IF;

  RETURN public.can_view_dc_row(_user_id, dc.project_id, dc.created_by, dc.etapa, dc.departamento);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.can_view_dc(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_dc(uuid, uuid) TO service_role;