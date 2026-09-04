import { query } from "@/server/db/pool";
import { HttpError } from "@/server/http/errors";

export type ProjectArea = {
  id: string;
  project_id: string;
  parent_id: string | null;
  nome: string;
  cor: string | null;
  display_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type AreaRow = Omit<ProjectArea, "created_at" | "updated_at"> & {
  created_at: Date | string;
  updated_at: Date | string;
};

function mapArea(row: AreaRow): ProjectArea {
  return {
    ...row,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
  };
}

async function requireCanReadProject(userId: string, projectId: string) {
  const result = await query<{ allowed: boolean }>(
    `
      select (
        public.is_admin($1::uuid)
        or public.is_project_member($1::uuid, $2::uuid)
      ) as allowed
    `,
    [userId, projectId],
  );

  if (!result.rows[0]?.allowed) {
    throw new HttpError(403, "forbidden", "Sem permissao para acessar este projeto.");
  }
}

async function requireCanManageProjectAreas(userId: string, projectId: string) {
  const result = await query<{ allowed: boolean }>(
    `select public.can_manage_project_base($1::uuid, $2::uuid) as allowed`,
    [userId, projectId],
  );

  if (!result.rows[0]?.allowed) {
    throw new HttpError(403, "forbidden", "Sem permissao para gerenciar areas deste projeto.");
  }
}

export async function listProjectAreas(userId: string, projectId: string) {
  await requireCanReadProject(userId, projectId);

  const result = await query<AreaRow>(
    `
      select id, project_id, parent_id, nome, cor, display_order, created_by, created_at, updated_at
      from public.project_areas
      where project_id = $1::uuid
      order by display_order, created_at
    `,
    [projectId],
  );

  return result.rows.map(mapArea);
}

export async function createProjectArea(input: {
  actorUserId: string;
  projectId: string;
  parentId?: string | null;
  nome: string;
  cor?: string | null;
  displayOrder?: number;
}) {
  await requireCanManageProjectAreas(input.actorUserId, input.projectId);

  const result = await query<AreaRow>(
    `
      insert into public.project_areas
        (project_id, parent_id, nome, cor, display_order, created_by)
      select $1::uuid, $2::uuid, $3, $4, $5, $6::uuid
      where $2::uuid is null
         or exists (
           select 1
           from public.project_areas parent
           where parent.id = $2::uuid
             and parent.project_id = $1::uuid
             and parent.parent_id is null
         )
      returning id, project_id, parent_id, nome, cor, display_order, created_by, created_at, updated_at
    `,
    [
      input.projectId,
      input.parentId ?? null,
      input.nome,
      input.cor ?? null,
      input.displayOrder ?? 0,
      input.actorUserId,
    ],
  );

  if (!result.rows[0]) {
    throw new HttpError(400, "invalid_parent", "Area pai invalida para este projeto.");
  }

  return mapArea(result.rows[0]);
}

export async function updateProjectArea(input: {
  actorUserId: string;
  projectId: string;
  areaId: string;
  nome?: string;
  cor?: string | null;
  displayOrder?: number;
}) {
  await requireCanManageProjectAreas(input.actorUserId, input.projectId);

  const result = await query<AreaRow>(
    `
      update public.project_areas
      set
        nome = coalesce($3, nome),
        cor = coalesce($4, cor),
        display_order = coalesce($5, display_order)
      where id = $1::uuid
        and project_id = $2::uuid
      returning id, project_id, parent_id, nome, cor, display_order, created_by, created_at, updated_at
    `,
    [input.areaId, input.projectId, input.nome ?? null, input.cor ?? null, input.displayOrder ?? null],
  );

  return result.rows[0] ? mapArea(result.rows[0]) : null;
}

export async function deleteProjectArea(input: {
  actorUserId: string;
  projectId: string;
  areaId: string;
}) {
  await requireCanManageProjectAreas(input.actorUserId, input.projectId);

  const result = await query<{ id: string }>(
    `
      delete from public.project_areas
      where id = $1::uuid
        and project_id = $2::uuid
      returning id
    `,
    [input.areaId, input.projectId],
  );

  return result.rowCount > 0;
}
