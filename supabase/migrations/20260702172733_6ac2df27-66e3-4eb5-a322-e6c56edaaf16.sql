
-- 1) Migrar papéis antigos dos membros
UPDATE public.project_members SET role = 'lider_estrategico'::public.project_role WHERE role = 'lider_superior'::public.project_role;
UPDATE public.project_members SET role = 'lider_tatico'::public.project_role WHERE role = 'lider_setor'::public.project_role;
UPDATE public.project_members SET role = 'lider_operacional'::public.project_role WHERE role = 'usuario_comum'::public.project_role;

-- 2) Tabela de versões da descrição de cargo
CREATE TABLE IF NOT EXISTS public.job_description_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_description_id uuid NOT NULL REFERENCES public.descricoes_cargo(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (job_description_id, version_number)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_description_versions TO authenticated;
GRANT ALL ON public.job_description_versions TO service_role;

ALTER TABLE public.job_description_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "versoes visiveis para quem ve a dc"
  ON public.job_description_versions FOR SELECT
  TO authenticated
  USING (public.can_view_dc(auth.uid(), job_description_id));

CREATE POLICY "versoes inseriveis por membros"
  ON public.job_description_versions FOR INSERT
  TO authenticated
  WITH CHECK (public.can_view_dc(auth.uid(), job_description_id));

-- 3) Tabela de comentários por campo
CREATE TABLE IF NOT EXISTS public.field_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_description_id uuid NOT NULL REFERENCES public.descricoes_cargo(id) ON DELETE CASCADE,
  version_id uuid REFERENCES public.job_description_versions(id) ON DELETE SET NULL,
  field_key text NOT NULL,
  author_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_field_comments_dc_field ON public.field_comments(job_description_id, field_key);
CREATE INDEX IF NOT EXISTS idx_field_comments_version ON public.field_comments(version_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.field_comments TO authenticated;
GRANT ALL ON public.field_comments TO service_role;

ALTER TABLE public.field_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comentarios visiveis para quem ve a dc"
  ON public.field_comments FOR SELECT
  TO authenticated
  USING (public.can_view_dc(auth.uid(), job_description_id));

CREATE POLICY "comentarios inseriveis pelo autor com acesso"
  ON public.field_comments FOR INSERT
  TO authenticated
  WITH CHECK (author_id = auth.uid() AND public.can_view_dc(auth.uid(), job_description_id));

CREATE POLICY "autor pode remover proprio comentario"
  ON public.field_comments FOR DELETE
  TO authenticated
  USING (author_id = auth.uid());

-- 4) Funções e triggers para snapshot automático
CREATE OR REPLACE FUNCTION public.create_dc_version_snapshot(_dc_id uuid, _created_by uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_num integer;
  snap jsonb;
  new_id uuid;
BEGIN
  SELECT COALESCE(MAX(version_number), 0) + 1 INTO next_num
  FROM public.job_description_versions
  WHERE job_description_id = _dc_id;

  SELECT to_jsonb(d) INTO snap FROM public.descricoes_cargo d WHERE d.id = _dc_id;
  IF snap IS NULL THEN RETURN NULL; END IF;

  INSERT INTO public.job_description_versions (job_description_id, version_number, snapshot, created_by)
  VALUES (_dc_id, next_num, snap, _created_by)
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.dc_snapshot_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.create_dc_version_snapshot(NEW.id, NEW.created_by);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dc_snapshot_on_insert ON public.descricoes_cargo;
CREATE TRIGGER trg_dc_snapshot_on_insert
AFTER INSERT ON public.descricoes_cargo
FOR EACH ROW EXECUTE FUNCTION public.dc_snapshot_on_insert();

CREATE OR REPLACE FUNCTION public.dc_snapshot_on_reopen()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.etapa <> NEW.etapa
     AND OLD.etapa = 'em_aprovacao'::public.dc_stage
     AND NEW.etapa = 'em_criacao'::public.dc_stage THEN
    PERFORM public.create_dc_version_snapshot(NEW.id, COALESCE(auth.uid(), NEW.created_by));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dc_snapshot_on_reopen ON public.descricoes_cargo;
CREATE TRIGGER trg_dc_snapshot_on_reopen
AFTER UPDATE OF etapa ON public.descricoes_cargo
FOR EACH ROW EXECUTE FUNCTION public.dc_snapshot_on_reopen();

-- 5) Snapshot inicial (v1) para descrições já existentes que ainda não possuem versão
INSERT INTO public.job_description_versions (job_description_id, version_number, snapshot, created_by)
SELECT d.id, 1, to_jsonb(d), d.created_by
FROM public.descricoes_cargo d
WHERE NOT EXISTS (
  SELECT 1 FROM public.job_description_versions v WHERE v.job_description_id = d.id
);
