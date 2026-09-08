import type { PoolClient } from "pg";
import { query, withTransaction } from "@/server/db/pool";
import { HttpError } from "@/server/http/errors";
import { requireCanManageProject, requireCanReadProject } from "@/server/projects/project-permissions";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

type ActivityLinkStatus = "pending" | "answered" | "expired" | "cancelled";

type ActivityLinkRow = {
  id: string;
  project_id: string;
  config_id: string;
  token: string;
  status: ActivityLinkStatus;
  expires_at: string;
  answered_at: string | null;
  reviewed_at: string | null;
  label: string | null;
  header_answers: JsonValue;
  draft_header_answers: JsonValue;
  draft_question_answers: JsonValue;
  draft_saved_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

const linkColumns = `
  id,
  project_id,
  config_id,
  token::text as token,
  status,
  expires_at,
  answered_at,
  reviewed_at,
  label,
  header_answers,
  draft_header_answers,
  draft_question_answers,
  draft_saved_at,
  created_by,
  created_at,
  updated_at
`;

async function expirePendingLinks(projectId: string, client?: PoolClient) {
  const runner = client ?? { query };
  await runner.query(
    `
      update public.activity_links
         set status = 'expired'
       where project_id = $1::uuid
         and status = 'pending'
         and expires_at < now()
    `,
    [projectId],
  );
}

async function expirePublicLink(linkId: string, client?: PoolClient) {
  const runner = client ?? { query };
  await runner.query(
    `update public.activity_links set status = 'expired' where id = $1::uuid`,
    [linkId],
  );
}

export async function getActivityConfig(userId: string, projectId: string) {
  await requireCanReadProject(userId, projectId);
  const result = await query(
    `
      select *
        from public.activity_configs
       where project_id = $1::uuid
       limit 1
    `,
    [projectId],
  );
  return result.rows[0] ?? null;
}

export async function upsertActivityConfig(input: {
  actorUserId: string;
  projectId: string;
  headerSchema: JsonValue;
  questionsSchema: JsonValue;
  isActive: boolean;
}) {
  await requireCanManageProject(input.actorUserId, input.projectId);
  const result = await query(
    `
      insert into public.activity_configs (
        project_id,
        header_schema,
        questions_schema,
        is_active,
        created_by
      )
      values ($1::uuid, $2::jsonb, $3::jsonb, $4::boolean, $5::uuid)
      on conflict (project_id) do update
        set header_schema = excluded.header_schema,
            questions_schema = excluded.questions_schema,
            is_active = excluded.is_active
      returning *
    `,
    [
      input.projectId,
      JSON.stringify(input.headerSchema),
      JSON.stringify(input.questionsSchema),
      input.isActive,
      input.actorUserId,
    ],
  );
  return result.rows[0];
}

export async function getActivityLinksPageData(userId: string, projectId: string) {
  await requireCanManageProject(userId, projectId);
  return withTransaction(async (client) => {
    await expirePendingLinks(projectId, client);
    const [config, links, employees, positions] = await Promise.all([
      client.query(
        `
          select id, header_schema, questions_schema
            from public.activity_configs
           where project_id = $1::uuid
           limit 1
        `,
        [projectId],
      ),
      client.query<ActivityLinkRow>(
        `
          select ${linkColumns}
            from public.activity_links
           where project_id = $1::uuid
           order by created_at desc
        `,
        [projectId],
      ),
      client.query(
        `
          select id, nome, position_id, area_id, sector_id
            from public.project_employees
           where project_id = $1::uuid
           order by nome
        `,
        [projectId],
      ),
      client.query(
        `
          select id, nome
            from public.project_positions
           where project_id = $1::uuid
           order by nome
        `,
        [projectId],
      ),
    ]);

    return {
      config: config.rows[0] ?? null,
      links: links.rows,
      employees: employees.rows,
      positions: positions.rows,
    };
  });
}

export async function createActivityLink(input: {
  actorUserId: string;
  projectId: string;
  configId: string;
  expiresAt: string;
  headerAnswers: JsonValue;
  label: string | null;
}) {
  await requireCanManageProject(input.actorUserId, input.projectId);
  const result = await query<ActivityLinkRow>(
    `
      insert into public.activity_links (
        project_id,
        config_id,
        expires_at,
        header_answers,
        label,
        created_by
      )
      select $1::uuid, id, $3::timestamptz, $4::jsonb, $5::text, $6::uuid
        from public.activity_configs
       where id = $2::uuid
         and project_id = $1::uuid
      returning ${linkColumns}
    `,
    [
      input.projectId,
      input.configId,
      input.expiresAt,
      JSON.stringify(input.headerAnswers),
      input.label,
      input.actorUserId,
    ],
  );

  if (!result.rows[0]) {
    throw new HttpError(404, "not_found", "Configuracao de atividade nao encontrada.");
  }

  return result.rows[0];
}

export async function updateActivityLink(input: {
  actorUserId: string;
  projectId: string;
  linkId: string;
  action: "cancel" | "reactivate" | "mark_reviewed";
  expiresAt?: string;
}) {
  await requireCanManageProject(input.actorUserId, input.projectId);

  const updates: Record<typeof input.action, { sql: string; values: unknown[] }> = {
    cancel: {
      sql: `
        update public.activity_links
           set status = 'cancelled'
         where id = $1::uuid
           and project_id = $2::uuid
        returning ${linkColumns}
      `,
      values: [input.linkId, input.projectId],
    },
    reactivate: {
      sql: `
        update public.activity_links
           set status = 'pending',
               expires_at = $3::timestamptz
         where id = $1::uuid
           and project_id = $2::uuid
        returning ${linkColumns}
      `,
      values: [input.linkId, input.projectId, input.expiresAt],
    },
    mark_reviewed: {
      sql: `
        update public.activity_links
           set reviewed_at = coalesce(reviewed_at, now())
         where id = $1::uuid
           and project_id = $2::uuid
        returning ${linkColumns}
      `,
      values: [input.linkId, input.projectId],
    },
  };

  if (input.action === "reactivate" && !input.expiresAt) {
    throw new HttpError(400, "invalid_body", "Data de expiracao obrigatoria.");
  }

  const update = updates[input.action];
  const result = await query<ActivityLinkRow>(update.sql, update.values);
  if (!result.rows[0]) {
    throw new HttpError(404, "not_found", "Link nao encontrado.");
  }
  return result.rows[0];
}

export async function getActivityResponseForLink(userId: string, projectId: string, linkId: string) {
  await requireCanManageProject(userId, projectId);
  return withTransaction(async (client) => {
    const linkResult = await client.query<ActivityLinkRow>(
      `
        select ${linkColumns}
          from public.activity_links
         where id = $1::uuid
           and project_id = $2::uuid
         limit 1
      `,
      [linkId, projectId],
    );
    const link = linkResult.rows[0];
    if (!link) {
      throw new HttpError(404, "not_found", "Link nao encontrado.");
    }

    const response = await client.query(
      `
        select *
          from public.activity_responses
         where link_id = $1::uuid
         limit 1
      `,
      [linkId],
    );

    if (link.status === "answered" && !link.reviewed_at) {
      await client.query(
        `
          update public.activity_links
             set reviewed_at = now()
           where id = $1::uuid
        `,
        [linkId],
      );
    }

    return { response: response.rows[0] ?? null };
  });
}

export async function getActivityCompilationData(userId: string, projectId: string) {
  await requireCanManageProject(userId, projectId);
  const [config, links, responses] = await Promise.all([
    query(
      `
        select header_schema, questions_schema
          from public.activity_configs
         where project_id = $1::uuid
         limit 1
      `,
      [projectId],
    ),
    query<ActivityLinkRow>(
      `
        select ${linkColumns}
          from public.activity_links
         where project_id = $1::uuid
         order by created_at desc
      `,
      [projectId],
    ),
    query(
      `
        select *
          from public.activity_responses
         where project_id = $1::uuid
         order by submitted_at asc
      `,
      [projectId],
    ),
  ]);

  return {
    config: config.rows[0] ?? null,
    links: links.rows,
    responses: responses.rows,
  };
}

function validatePublicToken(token: string) {
  if (!token || token.length < 20) {
    throw new HttpError(400, "invalid_token", "Link invalido.");
  }
}

async function getPublicLink(token: string, client?: PoolClient) {
  validatePublicToken(token);
  const runner = client ?? { query };
  const result = await runner.query<ActivityLinkRow>(
    `
      select ${linkColumns}
        from public.activity_links
       where token::text = $1
       limit 1
    `,
    [token],
  );
  return result.rows[0] ?? null;
}

function assertPublicLinkOpen(link: ActivityLinkRow | null) {
  if (!link) {
    throw new HttpError(404, "not_found", "Link nao encontrado.");
  }
  if (link.status === "cancelled") {
    throw new HttpError(410, "cancelled", "Link cancelado.");
  }
  if (link.status === "answered") {
    throw new HttpError(410, "already_answered", "Ja respondido.");
  }
}

export async function getPublicActivityForm(token: string) {
  const link = await getPublicLink(token);
  assertPublicLinkOpen(link);

  if (link!.status === "expired" || new Date(link!.expires_at) < new Date()) {
    await expirePublicLink(link!.id);
    throw new HttpError(410, "expired", "Este link expirou. Solicite um novo ao responsavel.");
  }

  const [config, areas] = await Promise.all([
    query(
      `
        select header_schema, questions_schema, is_active
          from public.activity_configs
         where id = $1::uuid
         limit 1
      `,
      [link!.config_id],
    ),
    query(
      `
        select id, parent_id, nome, cor
          from public.project_areas
         where project_id = $1::uuid
         order by display_order, created_at
      `,
      [link!.project_id],
    ),
  ]);

  const activityConfig = config.rows[0] as
    | { header_schema: JsonValue; questions_schema: JsonValue; is_active: boolean }
    | undefined;
  if (!activityConfig?.is_active) {
    throw new HttpError(410, "inactive", "O formulario esta inativo no momento.");
  }

  return {
    label: link!.label,
    prefilledHeader: link!.header_answers ?? {},
    draftHeader: link!.draft_header_answers ?? {},
    draftQuestions: link!.draft_question_answers ?? {},
    draftSavedAt: link!.draft_saved_at,
    areas: areas.rows,
    header: activityConfig.header_schema,
    questions: activityConfig.questions_schema,
  };
}

export async function savePublicActivityDraft(input: {
  token: string;
  headerAnswers: JsonValue;
  questionAnswers: JsonValue;
}) {
  const link = await getPublicLink(input.token);
  assertPublicLinkOpen(link);

  if (link!.status === "expired" || new Date(link!.expires_at) < new Date()) {
    await expirePublicLink(link!.id);
    throw new HttpError(410, "expired", "Link expirado.");
  }

  const savedAt = new Date().toISOString();
  await query(
    `
      update public.activity_links
         set draft_header_answers = $2::jsonb,
             draft_question_answers = $3::jsonb,
             draft_saved_at = $4::timestamptz
       where id = $1::uuid
    `,
    [
      link!.id,
      JSON.stringify(input.headerAnswers),
      JSON.stringify(input.questionAnswers),
      savedAt,
    ],
  );
  return { savedAt };
}

export async function submitPublicActivityResponse(input: {
  token: string;
  headerAnswers: JsonValue;
  questionAnswers: JsonValue;
  submittedIp: string | null;
}) {
  return withTransaction(async (client) => {
    const link = await getPublicLink(input.token, client);
    assertPublicLinkOpen(link);

    if (link!.status === "expired" || new Date(link!.expires_at) < new Date()) {
      await expirePublicLink(link!.id, client);
      throw new HttpError(410, "expired", "Link expirado.");
    }

    await client.query(
      `
        insert into public.activity_responses (
          link_id,
          project_id,
          header_answers,
          question_answers,
          submitted_ip
        )
        values ($1::uuid, $2::uuid, ($3::jsonb || $4::jsonb), $5::jsonb, $6::text)
      `,
      [
        link!.id,
        link!.project_id,
        JSON.stringify(link!.header_answers ?? {}),
        JSON.stringify(input.headerAnswers),
        JSON.stringify(input.questionAnswers),
        input.submittedIp,
      ],
    );

    await client.query(
      `
        update public.activity_links
           set status = 'answered',
               answered_at = now(),
               draft_header_answers = '{}'::jsonb,
               draft_question_answers = '[]'::jsonb,
               draft_saved_at = null
         where id = $1::uuid
      `,
      [link!.id],
    );
  });
}
