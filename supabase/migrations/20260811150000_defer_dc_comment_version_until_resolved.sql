CREATE OR REPLACE FUNCTION public.decide_field_comment(_comment_id uuid, _decision text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  comment_row public.field_comments%ROWTYPE;
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

  UPDATE public.field_comments
  SET decision = _decision,
      decided_by = auth.uid(),
      decided_at = now(),
      approved_version_id = NULL
  WHERE id = _comment_id;

  RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.decide_field_comment(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.finalize_resolved_dc_comments(_dc_id uuid, _version_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_num integer;
  snap jsonb;
  target_version_id uuid;
BEGIN
  IF NOT public.can_view_dc(auth.uid(), _dc_id) THEN
    RAISE EXCEPTION 'Sem permissao para finalizar comentarios desta descricao.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.field_comments
    WHERE job_description_id = _dc_id
      AND version_id = _version_id
  ) THEN
    RETURN NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.field_comments
    WHERE job_description_id = _dc_id
      AND version_id = _version_id
      AND decision = 'pending'
  ) THEN
    RETURN NULL;
  END IF;

  SELECT id INTO target_version_id
  FROM public.job_description_versions
  WHERE job_description_id = _dc_id
    AND source_comment_version_id = _version_id
  LIMIT 1;

  IF target_version_id IS NOT NULL THEN
    RETURN target_version_id;
  END IF;

  SELECT COALESCE(MAX(version_number), 0) + 1 INTO next_num
  FROM public.job_description_versions
  WHERE job_description_id = _dc_id;

  SELECT to_jsonb(d) INTO snap
  FROM public.descricoes_cargo d
  WHERE d.id = _dc_id;

  IF snap IS NULL THEN
    RAISE EXCEPTION 'Descricao nao encontrada.';
  END IF;

  INSERT INTO public.job_description_versions (
    job_description_id,
    version_number,
    snapshot,
    created_by,
    source_comment_version_id
  )
  VALUES (
    _dc_id,
    next_num,
    snap,
    auth.uid(),
    _version_id
  )
  RETURNING id INTO target_version_id;

  UPDATE public.field_comments
  SET approved_version_id = target_version_id
  WHERE job_description_id = _dc_id
    AND version_id = _version_id
    AND decision = 'approved';

  RETURN target_version_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.finalize_resolved_dc_comments(uuid, uuid) TO authenticated;
