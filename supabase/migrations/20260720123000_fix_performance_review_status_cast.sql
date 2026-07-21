CREATE OR REPLACE FUNCTION public.refresh_performance_review_status(_review_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_count integer;
  answered_count integer;
  current_status public.performance_review_status;
BEGIN
  SELECT status INTO current_status FROM public.performance_reviews WHERE id = _review_id;
  IF current_status = 'finalized' THEN
    RETURN;
  END IF;

  SELECT count(*), count(*) FILTER (WHERE status = 'answered')
    INTO total_count, answered_count
  FROM public.performance_review_participants
  WHERE review_id = _review_id;

  UPDATE public.performance_reviews
  SET status = CASE
    WHEN total_count = 2 AND answered_count = 2 THEN 'ready_for_comparison'::public.performance_review_status
    ELSE 'waiting_responses'::public.performance_review_status
  END
  WHERE id = _review_id;
END;
$$;
