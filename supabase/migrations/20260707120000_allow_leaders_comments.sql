-- Migration: permitir que líderes adicionem comentários e torná-los visíveis para todos
-- Ajustes feitos em: 2026-07-07

-- Remover políticas antigas (se existirem)
DROP POLICY IF EXISTS "comentarios inseriveis pelo autor com acesso" ON public.field_comments;
DROP POLICY IF EXISTS "comentarios visiveis para quem ve a dc" ON public.field_comments;
DROP POLICY IF EXISTS "comentarios visiveis para quem ve a dc ou se autor eh lider" ON public.field_comments;
DROP POLICY IF EXISTS "comentarios inseriveis por lideres_ou_admins" ON public.field_comments;

-- Policy SELECT: permite ver comentários se o usuário pode ver a DC
-- ou se o autor do comentário é um líder do projeto — assim comentários feitos por líderes
-- ficam visíveis para todos os autenticados.
CREATE POLICY "comentarios visiveis para quem ve a dc ou se autor eh lider"
  ON public.field_comments FOR SELECT
  TO authenticated
  USING (
    public.can_view_dc(auth.uid(), job_description_id)
    OR (
      EXISTS (
        SELECT 1
        FROM public.project_members pm
        WHERE pm.user_id = author_id
          AND pm.project_id = (
            SELECT project_id FROM public.descricoes_cargo WHERE id = job_description_id
          )
          AND pm.role IN (
            'lider_superior'::public.project_role,
            'lider_estrategico'::public.project_role,
            'lider_tatico'::public.project_role,
            'lider_operacional'::public.project_role,
            'lider_setor'::public.project_role
          )
      )
    )
  );

-- Policy INSERT: permite inserir comentários somente quando o autor for líder do projeto
CREATE POLICY "comentarios inseriveis por lideres"
  ON public.field_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.project_members pm
      WHERE pm.user_id = auth.uid()
        AND pm.project_id = (
          SELECT project_id FROM public.descricoes_cargo WHERE id = job_description_id
        )
        AND pm.role IN (
          'lider_superior'::public.project_role,
          'lider_estrategico'::public.project_role,
          'lider_tatico'::public.project_role,
          'lider_operacional'::public.project_role,
          'lider_setor'::public.project_role
        )
    )
  );

-- Mantemos a policy existente que permite autores removerem seus próprios comentários
-- A policy de DELETE existente não é alterada aqui.
