ALTER TABLE public.base_section_settings
ADD COLUMN IF NOT EXISTS is_enabled boolean NOT NULL DEFAULT true;
