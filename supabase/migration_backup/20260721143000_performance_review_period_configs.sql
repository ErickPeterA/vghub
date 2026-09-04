ALTER TABLE public.performance_review_configs
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS period_days integer;

UPDATE public.performance_review_configs
SET
  name = COALESCE(NULLIF(trim(name), ''), 'Padrao'),
  period_days = COALESCE(period_days, 30)
WHERE name IS NULL OR period_days IS NULL;

ALTER TABLE public.performance_review_configs
  ALTER COLUMN name SET DEFAULT 'Novo periodo',
  ALTER COLUMN period_days SET DEFAULT 30,
  ALTER COLUMN name SET NOT NULL,
  ALTER COLUMN period_days SET NOT NULL;

ALTER TABLE public.performance_review_configs
  ADD CONSTRAINT performance_review_configs_name_not_blank CHECK (length(trim(name)) > 0),
  ADD CONSTRAINT performance_review_configs_period_days_positive CHECK (period_days > 0);

ALTER TABLE public.performance_review_configs
  DROP CONSTRAINT IF EXISTS performance_review_configs_project_id_key;

WITH base_config AS (
  SELECT DISTINCT ON (project_id)
    project_id,
    questions_schema,
    is_active,
    created_by
  FROM public.performance_review_configs
  ORDER BY project_id, period_days
)
INSERT INTO public.performance_review_configs(project_id, name, period_days, questions_schema, is_active, created_by)
SELECT project_id, '45 dias', 45, questions_schema, is_active, created_by
FROM base_config base
WHERE NOT EXISTS (
  SELECT 1
  FROM public.performance_review_configs cfg
  WHERE cfg.project_id = base.project_id
    AND cfg.period_days = 45
);

WITH base_config AS (
  SELECT DISTINCT ON (project_id)
    project_id,
    questions_schema,
    is_active,
    created_by
  FROM public.performance_review_configs
  ORDER BY project_id, period_days
)
INSERT INTO public.performance_review_configs(project_id, name, period_days, questions_schema, is_active, created_by)
SELECT project_id, '90 dias', 90, questions_schema, is_active, created_by
FROM base_config base
WHERE NOT EXISTS (
  SELECT 1
  FROM public.performance_review_configs cfg
  WHERE cfg.project_id = base.project_id
    AND cfg.period_days = 90
);

CREATE UNIQUE INDEX IF NOT EXISTS performance_review_configs_project_period_unique
  ON public.performance_review_configs(project_id, period_days);

CREATE INDEX IF NOT EXISTS performance_review_configs_project_order_idx
  ON public.performance_review_configs(project_id, period_days);
