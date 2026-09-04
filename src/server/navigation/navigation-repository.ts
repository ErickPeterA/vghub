import { query } from "@/server/db/pool";
import { requireCanReadProject } from "@/server/projects/project-permissions";

export async function getGlobalNavigationPermissions(userId: string) {
  const result = await query<{ is_gp: boolean }>(
    `
      select exists (
        select 1 from public.project_members
        where user_id = $1::uuid and role = 'gp'::public.project_role
      ) as is_gp
    `,
    [userId],
  );
  return { isGp: result.rows[0]?.is_gp === true };
}

export async function getProjectNavigationData(userId: string, projectId: string) {
  await requireCanReadProject(userId, projectId);
  const [role, unreviewed] = await Promise.all([
    query<{ role: string }>(
      `select role::text as role from public.project_members where project_id = $1::uuid and user_id = $2::uuid`,
      [projectId, userId],
    ),
    query<{ count: string }>(
      `
        select count(*)::text as count
        from public.activity_links
        where project_id = $1::uuid
          and status = 'answered'::public.activity_link_status
          and reviewed_at is null
      `,
      [projectId],
    ),
  ]);
  return {
    projectRole: role.rows[0]?.role ?? null,
    unreviewed: Number(unreviewed.rows[0]?.count ?? 0),
  };
}
