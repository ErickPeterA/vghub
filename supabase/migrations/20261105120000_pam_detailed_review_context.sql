ALTER TABLE public.pam_items
  ADD COLUMN IF NOT EXISTS category_label text,
  ADD COLUMN IF NOT EXISTS question_label text,
  ADD COLUMN IF NOT EXISTS source_answer text;

