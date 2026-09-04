import { query } from "@/server/db/pool";
import { HttpError } from "@/server/http/errors";

export async function getProjectAccessPageData(projectId?: string) {
  const [members, profiles, areas] = await Promise.all([
    query(
      projectId
        ? `
            select pm.id, pm.project_id, pm.user_id, pm.role::text as role,
                   jsonb_build_object('id', p.id, 'nome', p.nome, 'email', p.email) as profiles,
                   jsonb_build_object('nome', pr.nome) as projects
            from public.project_members pm
            left join public.profiles p on p.id = pm.user_id
            left join public.projects pr on pr.id = pm.project_id
            where pm.project_id = $1::uuid
            order by p.nome nulls last
          `
        : `
            select pm.id, pm.project_id, pm.user_id, pm.role::text as role,
                   jsonb_build_object('nome', p.nome, 'email', p.email) as profiles,
                   jsonb_build_object('nome', pr.nome) as projects
            from public.project_members pm
            left join public.profiles p on p.id = pm.user_id
            left join public.projects pr on pr.id = pm.project_id
            order by pr.nome, p.nome
          `,
      projectId ? [projectId] : [],
    ),
    query(`select id, nome, email from public.profiles order by nome`),
    projectId
      ? query(
          `
            select id, nome, parent_id
            from public.project_areas
            where project_id = $1::uuid
            order by display_order, created_at
          `,
          [projectId],
        )
      : query(`select id, nome from public.projects order by nome`),
  ]);

  let scopes: { rows: unknown[] } = { rows: [] };
  if (projectId) {
    scopes = await query(
      `
        select pms.id, pms.member_id, pms.area_id
        from public.project_member_scopes pms
        join public.project_members pm on pm.id = pms.member_id
        where pm.project_id = $1::uuid
      `,
      [projectId],
    );
  }

  return { members: members.rows, profiles: profiles.rows, areasOrProjects: areas.rows, scopes: scopes.rows };
}

export async function addProjectMemberScope(memberId: string, areaId: string) {
  const result = await query(
    `
      insert into public.project_member_scopes (member_id, area_id)
      values ($1::uuid, $2::uuid)
      on conflict (member_id, area_id) do nothing
      returning id, member_id, area_id
    `,
    [memberId, areaId],
  );
  return result.rows[0] ?? null;
}

export async function removeProjectMemberScope(scopeId: string) {
  const result = await query(`delete from public.project_member_scopes where id = $1::uuid returning id`, [
    scopeId,
  ]);
  if (!result.rowCount) throw new HttpError(404, "not_found", "Escopo nao encontrado.");
}
