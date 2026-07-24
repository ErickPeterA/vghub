ALTER TABLE public.performance_review_participants
  ADD COLUMN IF NOT EXISTS sent_at timestamptz;
