ALTER TABLE public.field_comments
  ADD COLUMN IF NOT EXISTS decision text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS decided_by uuid,
  ADD COLUMN IF NOT EXISTS decided_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_version_id uuid REFERENCES public.job_description_versions(id) ON DELETE SET NULL;

ALTER TABLE public.field_comments
  DROP CONSTRAINT IF EXISTS field_comments_decision_check;

ALTER TABLE public.field_comments
  ADD CONSTRAINT field_comments_decision_check CHECK (decision IN ('pending', 'approved', 'rejected'));

ALTER TABLE public.job_description_versions
  ADD COLUMN IF NOT EXISTS source_comment_version_id uuid REFERENCES public.job_description_versions(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_job_description_versions_source_comment_version
  ON public.job_description_versions(job_description_id, source_comment_version_id)
  WHERE source_comment_version_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_dc_snapshot_on_reopen ON public.descricoes_cargo;

CREATE OR REPLACE FUNCTION public.decide_field_comment(_comment_id uuid, _decision text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  comment_row public.field_comments%ROWTYPE;
  next_num integer;
  snap jsonb;
  target_version_id uuid;
BEGIN
  IF _decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Decisao invalida.';
  END IF;

  SELECT * INTO comment_row
  FROM public.field_comments
  WHERE id = _comment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Comentario nao encontrado.';
  END IF;

  IF NOT public.can_view_dc(auth.uid(), comment_row.job_description_id) THEN
    RAISE EXCEPTION 'Sem permissao para avaliar este comentario.';
  END IF;

  IF _decision = 'approved' AND comment_row.version_id IS NOT NULL THEN
    SELECT id INTO target_version_id
    FROM public.job_description_versions
    WHERE job_description_id = comment_row.job_description_id
      AND source_comment_version_id = comment_row.version_id
    LIMIT 1;

    IF target_version_id IS NULL THEN
      SELECT COALESCE(MAX(version_number), 0) + 1 INTO next_num
      FROM public.job_description_versions
      WHERE job_description_id = comment_row.job_description_id;

      SELECT to_jsonb(d) INTO snap
      FROM public.descricoes_cargo d
      WHERE d.id = comment_row.job_description_id;

      INSERT INTO public.job_description_versions (
        job_description_id,
        version_number,
        snapshot,
        created_by,
        source_comment_version_id
      )
      VALUES (
        comment_row.job_description_id,
        next_num,
        snap,
        auth.uid(),
        comment_row.version_id
      )
      ON CONFLICT (job_description_id, source_comment_version_id) WHERE source_comment_version_id IS NOT NULL
      DO UPDATE SET source_comment_version_id = EXCLUDED.source_comment_version_id
      RETURNING id INTO target_version_id;
    END IF;
  ELSE
    target_version_id := comment_row.approved_version_id;
  END IF;

  UPDATE public.field_comments
  SET decision = _decision,
      decided_by = auth.uid(),
      decided_at = now(),
      approved_version_id = CASE WHEN _decision = 'approved' THEN target_version_id ELSE NULL END
  WHERE id = _comment_id;

  RETURN target_version_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.decide_field_comment(uuid, text) TO authenticated;
