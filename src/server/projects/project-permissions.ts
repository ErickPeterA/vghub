import { query } from "@/server/db/pool";
import { HttpError } from "@/server/http/errors";

export async function requireCanReadProject(userId: string, projectId: string) {
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

export async function requireCanManageProject(userId: string, projectId: string) {
  const result = await query<{ allowed: boolean }>(
    `select public.can_manage_project_base($1::uuid, $2::uuid) as allowed`,
    [userId, projectId],
  );

  if (!result.rows[0]?.allowed) {
    throw new HttpError(403, "forbidden", "Sem permissao para gerenciar este projeto.");
  }
}
