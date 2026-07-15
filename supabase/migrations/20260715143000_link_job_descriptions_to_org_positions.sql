ALTER TABLE public.descricoes_cargo
  ADD COLUMN IF NOT EXISTS organization_position_id uuid
  REFERENCES public.project_positions(id)
  ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS descricoes_cargo_org_position_unique
  ON public.descricoes_cargo(organization_position_id)
  WHERE organization_position_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS descricoes_cargo_org_position_idx
  ON public.descricoes_cargo(project_id, organization_position_id);
