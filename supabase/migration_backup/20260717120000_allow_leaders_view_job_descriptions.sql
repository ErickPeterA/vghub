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

  IF member IS NOT NULL AND member.role::text = 'gp' THEN
    RETURN true;
  END IF;

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

  IF member.role::text IN ('lider_superior', 'lider_estrategico', 'lider_tatico', 'lider_operacional') THEN
    RETURN true;
  END IF;

  IF member.role::text = 'lider_setor' THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.can_view_dc_row(uuid, uuid, uuid, public.dc_stage, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_dc_row(uuid, uuid, uuid, public.dc_stage, text) TO service_role;

CREATE OR REPLACE FUNCTION public.can_manage_dc_row(
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

  IF member IS NOT NULL AND member.role::text = 'gp' THEN
    RETURN true;
  END IF;

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

  IF _created_by = _user_id AND _etapa::text = 'em_criacao' THEN
    RETURN true;
  END IF;

  IF member.role::text = 'usuario_comum' THEN
    RETURN _created_by = _user_id;
  END IF;

  IF member.role::text IN ('lider_superior', 'lider_estrategico', 'lider_tatico', 'lider_operacional', 'lider_setor') THEN
    RETURN _etapa::text IN ('em_aprovacao', 'concluido');
  END IF;

  RETURN false;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.can_manage_dc_row(uuid, uuid, uuid, public.dc_stage, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_dc_row(uuid, uuid, uuid, public.dc_stage, text) TO service_role;
