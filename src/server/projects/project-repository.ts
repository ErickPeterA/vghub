import { query, withTransaction } from "@/server/db/pool";

export type ProjectSummary = {
  id: string;
  nome: string;
  empresa: string | null;
  status: string;
  responsavel_id: string | null;
  responsavel_nome: string | null;
  created_at: string;
};

type ProjectSummaryRow = Omit<ProjectSummary, "created_at"> & {
  created_at: Date | string;
};

export async function listProjectsForUser(userId: string): Promise<ProjectSummary[]> {
  const result = await query<ProjectSummaryRow>(
    `
      select
        p.id,
        p.nome,
        p.empresa,
        p.status::text as status,
        p.responsavel_id,
        responsavel.nome as responsavel_nome,
        p.created_at
      from public.projects p
      left join public.profiles responsavel on responsavel.id = p.responsavel_id
      where public.is_admin($1::uuid)
         or public.is_project_member($1::uuid, p.id)
      order by p.created_at desc
    `,
    [userId],
  );

  return result.rows.map((row) => ({
    ...row,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
  }));
}

export async function getProjectForUser(userId: string, projectId: string) {
  const result = await query<{ id: string; nome: string }>(
    `
      select id, nome
      from public.projects
      where id = $2::uuid
        and (
          public.is_admin($1::uuid)
          or public.is_project_member($1::uuid, id)
        )
    `,
    [userId, projectId],
  );

  return result.rows[0] ?? null;
}

export async function createProjectForAdmin(input: {
  actorUserId: string;
  nome: string;
  empresa?: string | null;
  responsavelId?: string | null;
}) {
  return withTransaction(async (client) => {
    const projectResult = await client.query<{ id: string }>(
      `
        insert into public.projects (nome, empresa, responsavel_id, created_by)
        values ($1, nullif($2::text, ''), $3::uuid, $4::uuid)
        returning id
      `,
      [input.nome, input.empresa ?? null, input.responsavelId ?? null, input.actorUserId],
    );
    const projectId = projectResult.rows[0]?.id;
    if (!projectId) throw new Error("Projeto nao foi criado.");

    await client.query(
      `
        insert into public.project_members (project_id, user_id, role)
        values ($1::uuid, $2::uuid, 'admin'::public.project_role)
        on conflict (project_id, user_id) do update set role = excluded.role
      `,
      [projectId, input.actorUserId],
    );

    if (input.responsavelId && input.responsavelId !== input.actorUserId) {
      await client.query(
        `
          insert into public.project_members (project_id, user_id, role)
          values ($1::uuid, $2::uuid, 'lider_estrategico'::public.project_role)
          on conflict (project_id, user_id) do update set role = excluded.role
        `,
        [projectId, input.responsavelId],
      );
    }

    await client.query(
      `
        insert into public.project_history
          (project_id, user_id, acao, entidade, entidade_id, detalhes)
        values
          ($1::uuid, $2::uuid, 'projeto_criado', 'project', $1::uuid, jsonb_build_object('nome', $3::text))
      `,
      [projectId, input.actorUserId, input.nome],
    );

    return { id: projectId };
  });
}

export async function updateProjectStatusForAdmin(input: {
  actorUserId: string;
  projectId: string;
  status: "ativo" | "desativado";
}) {
  const result = await query<{ id: string; nome: string; status: string }>(
    `
      update public.projects
      set status = $3::public.project_status
      where id = $2::uuid
        and public.is_admin($1::uuid)
      returning id, nome, status::text as status
    `,
    [input.actorUserId, input.projectId, input.status],
  );

  return result.rows[0] ?? null;
}
