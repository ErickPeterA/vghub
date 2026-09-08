import { query } from "@/server/db/pool";
import { requireCanReadProject } from "@/server/projects/project-permissions";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export async function getProjectHistoryPageData(userId: string, projectId: string) {
  await requireCanReadProject(userId, projectId);
  const items = await query(
    `
      select *
        from public.project_history
       where project_id = $1::uuid
       order by created_at desc
       limit 200
    `,
    [projectId],
  );

  const ids = Array.from(
    new Set(
      items.rows
        .flatMap((item) => [item.user_id, item.detalhes?.user_id])
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  );

  if (!ids.length) {
    return { items: items.rows, users: {} as Record<string, string> };
  }

  const profiles = await query<{ id: string; nome: string }>(
    `
      select id, nome
        from public.profiles
       where id = any($1::uuid[])
    `,
    [ids],
  );

  return {
    items: items.rows,
    users: Object.fromEntries(profiles.rows.map((profile) => [profile.id, profile.nome])),
  };
}

export async function logProjectAction(input: {
  actorUserId: string;
  projectId: string;
  acao: string;
  entidade: string | null;
  entidadeId: string | null;
  detalhes: JsonValue;
}) {
  await requireCanReadProject(input.actorUserId, input.projectId);
  await query(
    `
      insert into public.project_history (
        project_id,
        user_id,
        acao,
        entidade,
        entidade_id,
        detalhes
      )
      values ($1::uuid, $2::uuid, $3::text, $4::text, $5::uuid, $6::jsonb)
    `,
    [
      input.projectId,
      input.actorUserId,
      input.acao,
      input.entidade,
      input.entidadeId,
      JSON.stringify(input.detalhes ?? {}),
    ],
  );
}
