-- Renomeia o status "arquivado" de projetos para "desativado" e passa a usar
-- esse mesmo campo/botão para controlar acesso: quando um projeto é
-- desativado, todos os usuários vinculados perdem acesso a ele, exceto
-- membros com papel 'gp' e admins globais. Os dados do projeto continuam
-- intactos, só o acesso é bloqueado.
 
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_enum enum_value
    JOIN pg_type enum_type ON enum_type.oid = enum_value.enumtypid
    JOIN pg_namespace enum_schema ON enum_schema.oid = enum_type.typnamespace
    WHERE enum_schema.nspname = 'public'
      AND enum_type.typname = 'project_status'
      AND enum_value.enumlabel = 'arquivado'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM pg_enum enum_value
    JOIN pg_type enum_type ON enum_type.oid = enum_value.enumtypid
    JOIN pg_namespace enum_schema ON enum_schema.oid = enum_type.typnamespace
    WHERE enum_schema.nspname = 'public'
      AND enum_type.typname = 'project_status'
      AND enum_value.enumlabel = 'desativado'
  ) THEN
    ALTER TYPE public.project_status RENAME VALUE 'arquivado' TO 'desativado';
  END IF;
END $$;
 
-- is_project_member é usado como base de praticamente todas as policies de
-- leitura/escrita do sistema (descrições de cargo, base, hub, histórico,
-- andamento, templates, etc.), então ajustar essa função central já
-- propaga a regra de acesso para o app inteiro sem precisar reescrever
-- cada policy individualmente.
CREATE OR REPLACE FUNCTION public.is_project_member(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_members pm
    JOIN public.projects p ON p.id = pm.project_id
    WHERE pm.user_id = _user_id
      AND pm.project_id = _project_id
      AND (
        p.status <> 'desativado'::public.project_status
        OR pm.role = 'gp'::public.project_role
      )
  );
$$;
 
