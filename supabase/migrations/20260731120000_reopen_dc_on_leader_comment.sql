CREATE OR REPLACE FUNCTION public.reopen_dc_on_leader_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.decision = 'pending'
     AND EXISTS (
       SELECT 1
       FROM public.project_members pm
       JOIN public.descricoes_cargo dc ON dc.project_id = pm.project_id
       WHERE dc.id = NEW.job_description_id
         AND pm.user_id = NEW.author_id
         AND pm.role::text IN (
           'lider_superior',
           'lider_estrategico',
           'lider_tatico',
           'lider_operacional',
           'lider_setor'
         )
     ) THEN
    UPDATE public.descricoes_cargo
    SET etapa = 'em_criacao'::public.dc_stage
    WHERE id = NEW.job_description_id
      AND etapa <> 'em_criacao'::public.dc_stage;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reopen_dc_on_leader_comment ON public.field_comments;
CREATE TRIGGER trg_reopen_dc_on_leader_comment
AFTER INSERT ON public.field_comments
FOR EACH ROW EXECUTE FUNCTION public.reopen_dc_on_leader_comment();
