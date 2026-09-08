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

type DcStage = "em_criacao" | "em_aprovacao" | "concluido";

const leaderRoles = new Set([
  "lider_estrategico",
  "lider_tatico",
  "lider_operacional",
  "lider_superior",
  "lider_setor",
]);

const dcColumns = `
  id,
  project_id,
  created_by,
  cargo,
  unidade_negocio,
  departamento,
  nivelamento,
  superior_imediato,
  tipo_carreira,
  data_versao,
  data_revisao,
  status,
  objetivo,
  instrucao,
  experiencia,
  conhecimento,
  atividades,
  indicadores,
  habilidades_cargo,
  habilidades_culturais,
  postura,
  dynamic_values,
  etapa,
  organization_position_id,
  created_at,
  updated_at
`;

type DcPayload = {
  cargo: string;
  unidade_negocio: string | null;
  departamento: string | null;
  nivelamento: string | null;
  superior_imediato: string | null;
  tipo_carreira: string | null;
  data_versao: string | null;
  data_revisao: string | null;
  status: string;
  objetivo: string | null;
  instrucao: JsonValue;
  experiencia: JsonValue;
  conhecimento: JsonValue;
  atividades: JsonValue;
  indicadores: JsonValue;
  habilidades_cargo: JsonValue;
  habilidades_culturais: JsonValue;
  postura: JsonValue;
  dynamic_values: JsonValue;
  organization_position_id: string | null;
};

async function getProjectRole(userId: string, projectId: string) {
  const result = await query<{
    is_admin: boolean;
    role: string | null;
    is_responsavel: boolean;
  }>(
    `
      select
        public.is_admin($1::uuid) as is_admin,
        (
          select pm.role::text
            from public.project_members pm
           where pm.project_id = $2::uuid
             and pm.user_id = $1::uuid
           limit 1
        ) as role,
        exists (
          select 1
            from public.projects p
           where p.id = $2::uuid
             and p.responsavel_id = $1::uuid
        ) as is_responsavel
    `,
    [userId, projectId],
  );
  return result.rows[0] ?? { is_admin: false, role: null, is_responsavel: false };
}

function canApprove(role: Awaited<ReturnType<typeof getProjectRole>>) {
  return (
    role.is_admin ||
    role.role === "gp" ||
    role.role === "admin" ||
    (role.role !== null && leaderRoles.has(role.role))
  );
}

function canFullControl(role: Awaited<ReturnType<typeof getProjectRole>>) {
  return role.is_admin || role.is_responsavel || role.role === "gp" || role.role === "admin";
}

export async function getDcListPageData(userId: string, projectId: string) {
  await requireCanReadProject(userId, projectId);
  const [dcs, areas, profiles, role] = await Promise.all([
    query(
      `
        select id, cargo, departamento, unidade_negocio, created_by, created_at, etapa
          from public.descricoes_cargo
         where project_id = $1::uuid
         order by created_at desc
      `,
      [projectId],
    ),
    query(
      `
        select id, nome, cor, parent_id
          from public.project_areas
         where project_id = $1::uuid
      `,
      [projectId],
    ),
    query(`select id, nome from public.profiles`, []),
    getProjectRole(userId, projectId),
  ]);

  const ids = dcs.rows.map((row) => row.id);
  let pendingByDc = new Map<string, number>();
  if (ids.length) {
    const comments = await query<{ job_description_id: string; count: string }>(
      `
        select job_description_id, count(*)::text as count
          from public.field_comments
         where job_description_id = any($1::uuid[])
           and decision = 'pending'
         group by job_description_id
      `,
      [ids],
    );
    pendingByDc = new Map(
      comments.rows.map((row) => [row.job_description_id, Number(row.count)]),
    );
  }

  return {
    rows: dcs.rows.map((row) => ({
      ...row,
      pending_comment_count: pendingByDc.get(row.id) ?? 0,
    })),
    areas: areas.rows,
    profiles: profiles.rows,
    projectRole: role.role,
    isResponsavel: role.is_responsavel,
  };
}

export async function getDcProgressRows(userId: string, projectId: string) {
  await requireCanReadProject(userId, projectId);
  const result = await query(
    `
      select id, cargo, etapa, created_at
        from public.descricoes_cargo
       where project_id = $1::uuid
       order by created_at desc
    `,
    [projectId],
  );
  return result.rows;
}

export async function getPositionDescription(userId: string, projectId: string, positionId: string) {
  await requireCanReadProject(userId, projectId);
  const result = await query(
    `
      select id, cargo
        from public.descricoes_cargo
       where project_id = $1::uuid
         and organization_position_id = $2::uuid
       limit 1
    `,
    [projectId, positionId],
  );
  return result.rows[0] ?? null;
}

export async function getLinkedPositionData(userId: string, projectId: string, positionId: string) {
  await requireCanReadProject(userId, projectId);
  const result = await query(
    `
      select p.id, p.nome, p.parent_id, parent.nome as parent_nome
        from public.project_positions p
        left join public.project_positions parent
          on parent.id = p.parent_id
         and parent.project_id = p.project_id
       where p.project_id = $1::uuid
         and p.id = $2::uuid
       limit 1
    `,
    [projectId, positionId],
  );
  return result.rows[0] ?? null;
}

export async function getDcDetails(userId: string, projectId: string, dcId: string) {
  await requireCanReadProject(userId, projectId);
  const [current, versions, role] = await Promise.all([
    query(
      `
        select d.*, parent.nome as organization_superior_name
          from public.descricoes_cargo d
          left join public.project_positions pos
            on pos.id = d.organization_position_id
           and pos.project_id = d.project_id
          left join public.project_positions parent
            on parent.id = pos.parent_id
           and parent.project_id = pos.project_id
         where d.id = $1::uuid
           and d.project_id = $2::uuid
         limit 1
      `,
      [dcId, projectId],
    ),
    query(
      `
        select id, version_number, created_at, snapshot, source_comment_version_id
          from public.job_description_versions
         where job_description_id = $1::uuid
         order by version_number asc
      `,
      [dcId],
    ),
    getProjectRole(userId, projectId),
  ]);
  if (!current.rows[0]) throw new HttpError(404, "not_found", "Descricao nao encontrada.");
  return {
    current: current.rows[0],
    versions: versions.rows,
    projectRole: role.role,
    isResponsavel: role.is_responsavel,
  };
}

export async function createDc(input: {
  actorUserId: string;
  projectId: string;
  payload: DcPayload;
}) {
  await requireCanReadProject(input.actorUserId, input.projectId);
  const result = await query<{ id: string }>(
    `
      insert into public.descricoes_cargo (
        project_id, created_by, cargo, unidade_negocio, departamento, nivelamento,
        superior_imediato, tipo_carreira, data_versao, data_revisao, status, objetivo,
        instrucao, experiencia, conhecimento, atividades, indicadores, habilidades_cargo,
        habilidades_culturais, postura, dynamic_values, organization_position_id
      )
      values (
        $1::uuid, $2::uuid, $3::text, $4::text, $5::text, $6::text,
        $7::text, $8::text, $9::date, $10::date, $11::text, $12::text,
        $13::jsonb, $14::jsonb, $15::jsonb, $16::jsonb, $17::jsonb, $18::jsonb,
        $19::jsonb, $20::jsonb, $21::jsonb, $22::uuid
      )
      returning id
    `,
    payloadValues(input.projectId, input.actorUserId, input.payload),
  );
  return result.rows[0];
}

export async function updateDc(input: {
  actorUserId: string;
  projectId: string;
  dcId: string;
  payload: DcPayload;
  currentVersionId: string | null;
}) {
  await requireCanReadProject(input.actorUserId, input.projectId);
  return withTransaction(async (client) => {
    await client.query(`select set_config('app.current_user_id', $1, true)`, [input.actorUserId]);
    const result = await client.query(
      `
        update public.descricoes_cargo
           set cargo = $4::text,
               unidade_negocio = $5::text,
               departamento = $6::text,
               nivelamento = $7::text,
               superior_imediato = $8::text,
               tipo_carreira = $9::text,
               data_versao = $10::date,
               data_revisao = $11::date,
               status = $12::text,
               objetivo = $13::text,
               instrucao = $14::jsonb,
               experiencia = $15::jsonb,
               conhecimento = $16::jsonb,
               atividades = $17::jsonb,
               indicadores = $18::jsonb,
               habilidades_cargo = $19::jsonb,
               habilidades_culturais = $20::jsonb,
               postura = $21::jsonb,
               dynamic_values = $22::jsonb,
               organization_position_id = $23::uuid
         where id = $1::uuid
           and project_id = $2::uuid
        returning id
      `,
      [input.dcId, input.projectId, input.actorUserId, ...payloadValuesOnly(input.payload)],
    );
    if (!result.rows[0]) throw new HttpError(404, "not_found", "Descricao nao encontrada.");

    let versionId: string | null = null;
    if (input.currentVersionId) {
      const version = await client.query<{ version_id: string | null }>(
        `select public.finalize_resolved_dc_comments($1::uuid, $2::uuid) as version_id`,
        [input.dcId, input.currentVersionId],
      );
      versionId = version.rows[0]?.version_id ?? null;
    }
    return { versionId };
  });
}

export async function updateDcStage(input: {
  actorUserId: string;
  projectId: string;
  dcId: string;
  etapa: DcStage;
}) {
  const role = await getProjectRole(input.actorUserId, input.projectId);
  if (!canApprove(role)) {
    throw new HttpError(403, "forbidden", "Sem permissao para alterar a etapa.");
  }
  const result = await query(
    `
      update public.descricoes_cargo
         set etapa = $3::public.dc_stage
       where id = $1::uuid
         and project_id = $2::uuid
      returning id
    `,
    [input.dcId, input.projectId, input.etapa],
  );
  if (!result.rows[0]) throw new HttpError(404, "not_found", "Descricao nao encontrada.");
}

export async function finalizeDcReview(input: {
  actorUserId: string;
  projectId: string;
  dcId: string;
  versionId: string;
}) {
  await requireCanManageProject(input.actorUserId, input.projectId);
  const count = await query<{ count: string }>(
    `
      select count(*)::text as count
        from public.field_comments
       where job_description_id = $1::uuid
         and version_id = $2::uuid
    `,
    [input.dcId, input.versionId],
  );
  const comments = Number(count.rows[0]?.count ?? 0);
  const target: DcStage = comments > 0 ? "em_criacao" : "concluido";
  await updateDcStage({
    actorUserId: input.actorUserId,
    projectId: input.projectId,
    dcId: input.dcId,
    etapa: target,
  });
  return { comments, target };
}

export async function deleteDc(input: { actorUserId: string; projectId: string; dcId: string }) {
  const role = await getProjectRole(input.actorUserId, input.projectId);
  if (!canFullControl(role)) {
    throw new HttpError(403, "forbidden", "Sem permissao para excluir.");
  }
  const result = await query(
    `
      delete from public.descricoes_cargo
       where id = $1::uuid
         and project_id = $2::uuid
      returning id
    `,
    [input.dcId, input.projectId],
  );
  if (!result.rows[0]) throw new HttpError(404, "not_found", "Descricao nao encontrada.");
}

export async function getFieldComments(input: {
  userId: string;
  dcId: string;
  fieldKey: string;
  versionId: string | null;
}) {
  const dc = await query<{ project_id: string }>(
    `select project_id from public.descricoes_cargo where id = $1::uuid limit 1`,
    [input.dcId],
  );
  if (!dc.rows[0]) throw new HttpError(404, "not_found", "Descricao nao encontrada.");
  await requireCanReadProject(input.userId, dc.rows[0].project_id);

  const comments = await query(
    `
      select id, author_id, content, created_at, version_id, decision, decided_at,
             decided_by, approved_version_id
        from public.field_comments
       where job_description_id = $1::uuid
         and field_key = $2::text
         and ($3::uuid is null or version_id = $3::uuid)
       order by created_at asc
    `,
    [input.dcId, input.fieldKey, input.versionId],
  );
  const ids = Array.from(
    new Set(
      comments.rows
        .flatMap((comment) => [comment.author_id, comment.decided_by])
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  );
  const profiles = ids.length
    ? await query<{ id: string; nome: string }>(
        `select id, nome from public.profiles where id = any($1::uuid[])`,
        [ids],
      )
    : { rows: [] };
  return {
    comments: comments.rows,
    authors: Object.fromEntries(profiles.rows.map((profile) => [profile.id, profile.nome])),
  };
}

export async function addFieldComment(input: {
  actorUserId: string;
  dcId: string;
  fieldKey: string;
  versionId: string | null;
  content: string;
}) {
  const dc = await query<{ project_id: string }>(
    `select project_id from public.descricoes_cargo where id = $1::uuid limit 1`,
    [input.dcId],
  );
  if (!dc.rows[0]) throw new HttpError(404, "not_found", "Descricao nao encontrada.");
  await requireCanReadProject(input.actorUserId, dc.rows[0].project_id);
  await query(
    `
      insert into public.field_comments (
        job_description_id, field_key, version_id, author_id, content
      )
      values ($1::uuid, $2::text, $3::uuid, $4::uuid, $5::text)
    `,
    [input.dcId, input.fieldKey, input.versionId, input.actorUserId, input.content],
  );
}

export async function decideFieldComment(input: {
  actorUserId: string;
  commentId: string;
  decision: "approved" | "rejected";
}) {
  return withTransaction(async (client) => {
    await client.query(`select set_config('app.current_user_id', $1, true)`, [input.actorUserId]);
    await client.query(`select public.decide_field_comment($1::uuid, $2::text)`, [
      input.commentId,
      input.decision,
    ]);
  });
}

function payloadValues(projectId: string, actorUserId: string, payload: DcPayload) {
  return [projectId, actorUserId, ...payloadValuesOnly(payload)];
}

function payloadValuesOnly(payload: DcPayload) {
  return [
    payload.cargo,
    payload.unidade_negocio,
    payload.departamento,
    payload.nivelamento,
    payload.superior_imediato,
    payload.tipo_carreira,
    payload.data_versao,
    payload.data_revisao,
    payload.status,
    payload.objetivo,
    JSON.stringify(payload.instrucao ?? []),
    JSON.stringify(payload.experiencia ?? []),
    JSON.stringify(payload.conhecimento ?? []),
    JSON.stringify(payload.atividades ?? []),
    JSON.stringify(payload.indicadores ?? []),
    JSON.stringify(payload.habilidades_cargo ?? []),
    JSON.stringify(payload.habilidades_culturais ?? []),
    JSON.stringify(payload.postura ?? []),
    JSON.stringify(payload.dynamic_values ?? {}),
    payload.organization_position_id,
  ];
}
