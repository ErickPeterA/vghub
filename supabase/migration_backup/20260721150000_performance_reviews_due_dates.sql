ALTER TABLE public.performance_reviews
  ADD COLUMN IF NOT EXISTS employee_id uuid REFERENCES public.project_employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS period_name text,
  ADD COLUMN IF NOT EXISTS period_days integer,
  ADD COLUMN IF NOT EXISTS due_date date;

CREATE INDEX IF NOT EXISTS performance_reviews_due_date_idx
  ON public.performance_reviews(project_id, due_date);

CREATE INDEX IF NOT EXISTS performance_reviews_employee_idx
  ON public.performance_reviews(project_id, employee_id);
