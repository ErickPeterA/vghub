import type { PoolClient } from "pg";
import { query, withTransaction } from "@/server/db/pool";
import { requireCanManageProject, requireCanReadProject } from "@/server/projects/project-permissions";

export type OrganizationPositionInput = {
  nome: string;
  descricao: string | null;
  parent_id: string | null;
  display_order: number;
  status: "active" | "inactive";
};

async function withActor<T>(userId: string, callback: (client: PoolClient) => Promise<T>) {
  return withTransaction(async (client) => {
    await client.query(`select set_config('app.current_user_id', $1, true)`, [userId]);
    return callback(client);
  });
}

export async function getOrganizationPageData(userId: string, projectId: string) {
  await requireCanReadProject(userId, projectId);
  const [positions, descriptions] = await Promise.all([
    query(
      `
        select id, project_id, parent_id, nome, descricao, display_order, status::text as status,
               created_by, created_at, updated_at
        from public.project_positions
        where project_id = $1::uuid
        order by display_order, created_at
      `,
      [projectId],
    ),
    query<{ organization_position_id: string | null }>(
      `
        select organization_position_id
        from public.descricoes_cargo
        where project_id = $1::uuid and organization_position_id is not null
      `,
      [projectId],
    ),
  ]);

  return {
    positions: positions.rows,
    positionsWithDescription: descriptions.rows
      .map((row) => row.organization_position_id)
      .filter(Boolean),
  };
}

export async function createPosition(
  actorUserId: string,
  projectId: string,
  values: OrganizationPositionInput,
) {
  await requireCanManageProject(actorUserId, projectId);
  const result = await query(
    `
      insert into public.project_positions
        (project_id, parent_id, nome, descricao, display_order, status, created_by)
      values ($1::uuid, $2::uuid, $3, $4, $5, $6::public.organization_position_status, $7::uuid)
      returning id
    `,
    [
      projectId,
      values.parent_id,
      values.nome,
      values.descricao,
      values.display_order,
      values.status,
      actorUserId,
    ],
  );
  return result.rows[0];
}

export async function updatePosition(
  actorUserId: string,
  projectId: string,
  positionId: string,
  values: OrganizationPositionInput,
) {
  await requireCanManageProject(actorUserId, projectId);
  const result = await query(
    `
      update public.project_positions
      set nome = $3,
          descricao = $4,
          parent_id = $5::uuid,
          display_order = $6,
          status = $7::public.organization_position_status
      where id = $1::uuid and project_id = $2::uuid
      returning id
    `,
    [
      positionId,
      projectId,
      values.nome,
      values.descricao,
      values.parent_id,
      values.display_order,
      values.status,
    ],
  );
  return result.rows[0] ?? null;
}

export async function shiftPositionOrders(
  actorUserId: string,
  projectId: string,
  updates: Array<{ id: string; parentId?: string | null; displayOrder: number }>,
) {
  await requireCanManageProject(actorUserId, projectId);
  return withTransaction(async (client) => {
    for (const update of updates) {
      await client.query(
        `
          update public.project_positions
          set display_order = $3,
              parent_id = $4::uuid
          where id = $1::uuid and project_id = $2::uuid
        `,
        [update.id, projectId, update.displayOrder, update.parentId ?? null],
      );
    }
    return { ok: true };
  });
}

export async function insertPositionAbove(
  actorUserId: string,
  targetId: string,
  values: Pick<OrganizationPositionInput, "nome" | "descricao" | "status">,
) {
  return withActor(actorUserId, async (client) => {
    const result = await client.query(
      `select public.insert_project_position_above($1::uuid, $2, $3, $4::public.organization_position_status) as id`,
      [targetId, values.nome, values.descricao, values.status],
    );
    return result.rows[0];
  });
}

export async function movePosition(actorUserId: string, positionId: string, parentId: string | null) {
  return withActor(actorUserId, async (client) => {
    await client.query(`select public.move_project_position($1::uuid, $2::uuid)`, [positionId, parentId]);
    return { ok: true };
  });
}

export async function deletePosition(
  actorUserId: string,
  positionId: string,
  childrenParentId: string | null,
) {
  return withActor(actorUserId, async (client) => {
    await client.query(`select public.delete_project_position_with_reassignment($1::uuid, $2::uuid)`, [
      positionId,
      childrenParentId,
    ]);
    return { ok: true };
  });
}

export async function reorderPosition(
  actorUserId: string,
  positionId: string,
  direction: "up" | "down",
) {
  return withActor(actorUserId, async (client) => {
    await client.query(`select public.reorder_project_position($1::uuid, $2)`, [positionId, direction]);
    return { ok: true };
  });
}
