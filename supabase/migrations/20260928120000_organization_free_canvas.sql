ALTER TABLE public.project_positions
  ADD COLUMN IF NOT EXISTS layout_x double precision,
  ADD COLUMN IF NOT EXISTS layout_y double precision,
  ADD COLUMN IF NOT EXISTS connection_source_handle text NOT NULL DEFAULT 'right'
    CHECK (connection_source_handle IN ('top', 'right', 'bottom', 'left')),
  ADD COLUMN IF NOT EXISTS connection_target_handle text NOT NULL DEFAULT 'left'
    CHECK (connection_target_handle IN ('top', 'right', 'bottom', 'left'));

COMMENT ON COLUMN public.project_positions.layout_x IS
  'Coordenada horizontal do cargo no canvas livre do organograma.';

COMMENT ON COLUMN public.project_positions.layout_y IS
  'Coordenada vertical do cargo no canvas livre do organograma.';

COMMENT ON COLUMN public.project_positions.connection_source_handle IS
  'Lado do cargo superior de onde parte a conexao.';

COMMENT ON COLUMN public.project_positions.connection_target_handle IS
  'Lado do cargo subordinado onde chega a conexao.';
