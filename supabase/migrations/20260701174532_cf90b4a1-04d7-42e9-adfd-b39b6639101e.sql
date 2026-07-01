
-- 1) Add FK from project_members.user_id -> profiles.id so PostgREST can resolve profiles(...) joins
ALTER TABLE public.project_members
  ADD CONSTRAINT project_members_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Same for project_history.user_id (used in Historico page joins)
ALTER TABLE public.project_history
  ADD CONSTRAINT project_history_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 2) Fix descricoes_cargo INSERT policy: allow admin, project member, or project responsavel
DROP POLICY IF EXISTS "dc insert" ON public.descricoes_cargo;
CREATE POLICY "dc insert" ON public.descricoes_cargo
FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND (
    public.is_admin(auth.uid())
    OR public.is_project_member(auth.uid(), project_id)
    OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.responsavel_id = auth.uid())
  )
);

-- 3) Update can_view_dc so:
--   - em_criacao: admin, responsavel, gp, admin(projeto) e o criador (usuario_comum) veem;
--     lideres NAO veem em_criacao
--   - em_aprovacao/concluido: regras existentes por papel
CREATE OR REPLACE FUNCTION public.can_view_dc(_user_id uuid, _dc_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
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

  IF EXISTS (SELECT 1 FROM public.projects p WHERE p.id = dc.project_id AND p.responsavel_id = _user_id) THEN
    RETURN true;
  END IF;

  SELECT * INTO member FROM public.project_members
   WHERE project_id = dc.project_id AND user_id = _user_id LIMIT 1;
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
  IF member.role::text = 'lider_superior' THEN RETURN true; END IF;

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

-- 4) Also allow updating etapa for GPs/admins/lideres (SELECT already gates via can_view_dc; UPDATE uses same fn — OK)
