
CREATE TYPE public.dc_stage AS ENUM ('em_criacao','em_aprovacao','concluido');

ALTER TABLE public.descricoes_cargo
  ADD COLUMN etapa public.dc_stage NOT NULL DEFAULT 'em_criacao';

CREATE OR REPLACE FUNCTION public.log_dc_stage_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.etapa IS DISTINCT FROM OLD.etapa THEN
    INSERT INTO public.project_history(project_id, user_id, acao, entidade, entidade_id, detalhes)
    VALUES (NEW.project_id, auth.uid(), 'dc_etapa_alterada', 'descricao_cargo', NEW.id,
            jsonb_build_object('de', OLD.etapa, 'para', NEW.etapa));
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_dc_stage_log
AFTER UPDATE OF etapa ON public.descricoes_cargo
FOR EACH ROW EXECUTE FUNCTION public.log_dc_stage_change();
