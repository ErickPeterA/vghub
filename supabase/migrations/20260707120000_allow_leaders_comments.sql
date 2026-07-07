DROP POLICY IF EXISTS "comentarios inseriveis pelo autor com acesso" ON public.field_comments;
DROP POLICY IF EXISTS "comentarios visiveis para quem ve a dc" ON public.field_comments;
DROP POLICY IF EXISTS "comentarios visiveis para quem ve a dc ou se autor eh lider" ON public.field_comments;
DROP POLICY IF EXISTS "comentarios inseriveis por lideres_ou_admins" ON public.field_comments;
DROP POLICY IF EXISTS "comentarios inseriveis por lideres" ON public.field_comments;

CREATE POLICY "comentarios visiveis para quem ve a dc ou se autor eh lider"
  ON public.field_comments FOR SELECT
  TO authenticated
  USING (
    public.can_view_dc(auth.uid(), job_description_id)
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.user_id = author_id
        AND pm.project_id = (SELECT project_id FROM public.descricoes_cargo WHERE id = job_description_id)
        AND pm.role IN ('lider_superior','lider_estrategico','lider_tatico','lider_operacional','lider_setor')
    )
  );

CREATE POLICY "comentarios inseriveis por lideres"
  ON public.field_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.user_id = auth.uid()
        AND pm.project_id = (SELECT project_id FROM public.descricoes_cargo WHERE id = job_description_id)
        AND pm.role IN ('lider_superior','lider_estrategico','lider_tatico','lider_operacional','lider_setor')
    )
  );