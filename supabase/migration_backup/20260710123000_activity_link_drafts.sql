ALTER TABLE public.activity_links
  ADD COLUMN IF NOT EXISTS draft_header_answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS draft_question_answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS draft_saved_at TIMESTAMPTZ;
