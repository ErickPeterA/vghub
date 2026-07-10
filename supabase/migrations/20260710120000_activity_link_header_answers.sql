ALTER TABLE public.activity_links
  ADD COLUMN IF NOT EXISTS header_answers JSONB NOT NULL DEFAULT '{}'::jsonb;
