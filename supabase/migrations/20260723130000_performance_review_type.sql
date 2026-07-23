ALTER TABLE public.performance_reviews
  ADD COLUMN IF NOT EXISTS review_type text NOT NULL DEFAULT 'experience';

UPDATE public.performance_reviews review
SET review_type =
  CASE
    WHEN employee.admission_date IS NOT NULL
      AND review.created_at::date - employee.admission_date > 90
      THEN 'performance'
    ELSE 'experience'
  END
FROM public.project_employees employee
WHERE review.employee_id = employee.id
  AND review.review_type = 'experience';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'performance_reviews_review_type_check'
      AND conrelid = 'public.performance_reviews'::regclass
  ) THEN
    ALTER TABLE public.performance_reviews
      ADD CONSTRAINT performance_reviews_review_type_check
      CHECK (review_type IN ('experience', 'performance'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS performance_reviews_review_type_idx
  ON public.performance_reviews(project_id, review_type);
