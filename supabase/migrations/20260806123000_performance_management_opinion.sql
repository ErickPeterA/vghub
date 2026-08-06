ALTER TABLE public.performance_reviews
  ADD COLUMN IF NOT EXISTS management_opinion text,
  ADD COLUMN IF NOT EXISTS score_summary_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;
