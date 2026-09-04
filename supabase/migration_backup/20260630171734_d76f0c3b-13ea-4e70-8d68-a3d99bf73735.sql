
-- Migrar perfis antigos para lider_superior
UPDATE public.project_members
SET role = 'lider_superior'::public.project_role
WHERE role::text IN ('lider_estrategico','lider_tatico','lider_operacional');

-- Tabela de escopos
CREATE TABLE public.project_member_scopes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id uuid NOT NULL REFERENCES public.project_members(id) ON DELETE CASCADE,
  area_id uuid REFERENCES public.project_areas(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX project_member_scopes_unique ON public.project_member_scopes(member_id, area_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_member_scopes TO authenticated;
GRANT ALL ON public.project_member_scopes TO service_role;

ALTER TABLE public.project_member_scopes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scopes read" ON public.project_member_scopes FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.project_members m
      JOIN public.projects p ON p.id = m.project_id
      WHERE m.id = member_id AND (p.responsavel_id = auth.uid() OR m.user_id = auth.uid())
    )
  );

CREATE POLICY "scopes write" ON public.project_member_scopes TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.project_members m
      JOIN public.projects p ON p.id = m.project_id
      WHERE m.id = member_id AND p.responsavel_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.project_members m
      JOIN public.projects p ON p.id = m.project_id
      WHERE m.id = member_id AND p.responsavel_id = auth.uid()
    )
  );

-- Função: dado um setor (uuid em texto), retorna ancestrais incluindo ele
CREATE OR REPLACE FUNCTION public.area_ancestors(_area_id uuid)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH RECURSIVE chain AS (
    SELECT id, parent_id FROM public.project_areas WHERE id = _area_id
    UNION ALL
    SELECT a.id, a.parent_id FROM public.project_areas a
    JOIN chain c ON a.id = c.parent_id
  )
  SELECT id FROM chain;
$$;

-- Função principal de visibilidade
CREATE OR REPLACE FUNCTION public.can_view_dc(_user_id uuid, _dc_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  dc record;
  member record;
  setor_uuid uuid;
BEGIN
  SELECT * INTO dc FROM public.descricoes_cargo WHERE id = _dc_id;
  IF dc IS NULL THEN RETURN false; END IF;

  IF public.is_admin(_user_id) THEN RETURN true; END IF;

  -- responsável do projeto vê tudo
  IF EXISTS (SELECT 1 FROM public.projects p WHERE p.id = dc.project_id AND p.responsavel_id = _user_id) THEN
    RETURN true;
  END IF;

  SELECT * INTO member FROM public.project_members
   WHERE project_id = dc.project_id AND user_id = _user_id LIMIT 1;
  IF member IS NULL THEN RETURN false; END IF;

  -- gp, admin de projeto, lider_superior: tudo do projeto
  IF member.role::text IN ('gp','admin','lider_superior') THEN RETURN true; END IF;

  -- usuário comum: só a própria DC
  IF member.role::text = 'usuario_comum' THEN
    RETURN dc.created_by = _user_id;
  END IF;

  -- lider_setor: precisa que o setor da DC esteja no escopo (recursivo nos ancestrais)
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
END $$;

-- Atualizar policies de descricoes_cargo
DROP POLICY IF EXISTS "dc read" ON public.descricoes_cargo;
DROP POLICY IF EXISTS "dc update" ON public.descricoes_cargo;
DROP POLICY IF EXISTS "dc delete" ON public.descricoes_cargo;

CREATE POLICY "dc read" ON public.descricoes_cargo FOR SELECT TO authenticated
  USING (public.can_view_dc(auth.uid(), id));

CREATE POLICY "dc update" ON public.descricoes_cargo FOR UPDATE TO authenticated
  USING (public.can_view_dc(auth.uid(), id));

CREATE POLICY "dc delete" ON public.descricoes_cargo FOR DELETE TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.responsavel_id = auth.uid())
    OR created_by = auth.uid()
  );
