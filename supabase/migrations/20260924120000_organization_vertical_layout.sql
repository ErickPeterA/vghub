ALTER TABLE public.project_positions
  ADD COLUMN IF NOT EXISTS visual_level integer NOT NULL DEFAULT 1;

WITH ordered_positions AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY project_id, parent_id
      ORDER BY display_order, created_at, id
    )::integer AS inferred_visual_level
  FROM public.project_positions
)
UPDATE public.project_positions AS position
SET visual_level = ordered_positions.inferred_visual_level
FROM ordered_positions
WHERE ordered_positions.id = position.id;

ALTER TABLE public.project_positions
  ADD CONSTRAINT project_positions_visual_level_positive CHECK (visual_level >= 1);

COMMENT ON COLUMN public.project_positions.visual_level IS
  'Camada visual entre cargos que possuem o mesmo superior imediato.';
