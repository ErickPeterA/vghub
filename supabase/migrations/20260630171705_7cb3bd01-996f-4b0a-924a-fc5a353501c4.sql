
-- 1) Novos valores no enum
ALTER TYPE public.project_role ADD VALUE IF NOT EXISTS 'lider_superior';
ALTER TYPE public.project_role ADD VALUE IF NOT EXISTS 'lider_setor';
ALTER TYPE public.project_role ADD VALUE IF NOT EXISTS 'usuario_comum';
