ALTER TABLE public.project_employees
  ADD COLUMN IF NOT EXISTS email text;

ALTER TABLE public.project_employees
  DROP CONSTRAINT IF EXISTS project_employees_email_not_blank;

ALTER TABLE public.project_employees
  ADD CONSTRAINT project_employees_email_not_blank
  CHECK (email IS NULL OR length(trim(email)) > 0);

CREATE UNIQUE INDEX IF NOT EXISTS project_employees_project_email_unique
  ON public.project_employees (project_id, lower(email))
  WHERE email IS NOT NULL;
