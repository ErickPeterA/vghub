import type { PoolClient } from "pg";
import { query, withTransaction } from "@/server/db/pool";
import { HttpError } from "@/server/http/errors";
import {
  requireCanManageProject,
  requireCanReadProject,
} from "@/server/projects/project-permissions";

type JsonValue = unknown;
type ReviewType = "experience" | "performance";

async function requireCanManageConfigScope(userId: string, projectId: string | null) {
  if (projectId) return requireCanManageProject(userId, projectId);
  const result = await query<{ allowed: boolean }>(`select public.is_any_gp($1::uuid) as allowed`, [
    userId,
  ]);
  if (!result.rows[0]?.allowed) {
    throw new HttpError(403, "forbidden", "Sem permissao para gerenciar modelos gerais.");
  }
}

export async function canUsePerformanceManager(userId: string, projectId: string) {
  await requireCanReadProject(userId, projectId);
  const result = await query<{ allowed: boolean }>(
    `
      select (
        public.is_admin($1::uuid)
        or exists (
          select 1
            from public.project_members pm
           where pm.project_id = $2::uuid
             and pm.user_id = $1::uuid
             and pm.role in ('gp'::public.project_role, 'admin'::public.project_role)
        )
      ) as allowed
    `,
    [userId, projectId],
  );
  return result.rows[0]?.allowed === true;
}

const baseFieldsSql = `
  select
    f.field_key,
    f.label,
    f.section,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'label', o.label,
          'value', o.value,
          'description', o.description,
          'is_active', o.is_active
        ) order by o.display_order, o.created_at
      ) filter (where o.id is not null),
      '[]'::jsonb
    ) as base_options
  from public.base_fields f
  left join public.base_options o on o.field_id = f.id
  where f.project_id = $1::uuid
    and f.is_active = true
  group by f.id
  order by f.display_order, f.created_at
`;

export async function getPerformanceWorkspaceData(userId: string, projectId: string) {
  if (!(await canUsePerformanceManager(userId, projectId))) {
    throw new HttpError(403, "forbidden", "Acesso restrito a GP e administradores.");
  }

  const [
    reviews,
    participants,
    positions,
    employees,
    descriptions,
    configs,
    fields,
    weights,
    scores,
    areas,
  ] = await Promise.all([
    query(
      `select * from public.performance_reviews where project_id = $1::uuid order by created_at desc`,
      [projectId],
    ),
    query(`select * from public.performance_review_participants where project_id = $1::uuid`, [
      projectId,
    ]),
    query(
      `select id, nome, parent_id from public.project_positions where project_id = $1::uuid and status = 'active' order by display_order`,
      [projectId],
    ),
    query(
      `select id, project_id, position_id, area_id, sector_id, superior_imediato_id, nome, admission_date, last_performance_review_date from public.project_employees where project_id = $1::uuid order by nome`,
      [projectId],
    ),
    query(`select * from public.descricoes_cargo where project_id = $1::uuid`, [projectId]),
    query(
      `select * from public.performance_review_configs where project_id = $1::uuid and is_active = true order by period_days`,
      [projectId],
    ),
    query(baseFieldsSql, [projectId]),
    query(
      `select career_key, career_label, weights from public.evaluation_weight_configs where project_id = $1::uuid order by career_label`,
      [projectId],
    ),
    query(
      `select criterion_key, scoring_schema from public.criterion_scoring_configs where project_id = $1::uuid order by criterion_key`,
      [projectId],
    ),
    query(
      `select id, nome from public.project_areas where project_id = $1::uuid order by display_order, created_at`,
      [projectId],
    ),
  ]);

  return {
    reviews: reviews.rows,
    participants: participants.rows,
    positions: positions.rows,
    employees: employees.rows,
    descriptions: descriptions.rows,
    configs: configs.rows,
    baseFields: fields.rows,
    weightConfigs: weights.rows,
    scoringConfigs: scores.rows,
    areas: areas.rows,
  };
}

export async function getPerformanceScoringData(userId: string, projectId: string) {
  await requireCanReadProject(userId, projectId);
  const [fields, descriptions, weights, configs, scores] = await Promise.all([
    query(baseFieldsSql, [projectId]),
    query(
      `select tipo_carreira, dynamic_values from public.descricoes_cargo where project_id = $1::uuid`,
      [projectId],
    ),
    query(
      `select career_key, career_label, weights from public.evaluation_weight_configs where project_id = $1::uuid order by career_label`,
      [projectId],
    ),
    query(
      `select questions_schema from public.performance_review_configs where project_id = $1::uuid and review_type = 'performance' and is_active = true order by updated_at desc limit 1`,
      [projectId],
    ),
    query(
      `select criterion_key, scoring_schema from public.criterion_scoring_configs where project_id = $1::uuid order by criterion_key`,
      [projectId],
    ),
  ]);
  return {
    baseFields: fields.rows,
    descriptions: descriptions.rows,
    weightConfigs: weights.rows,
    performanceConfig: configs.rows[0] ?? null,
    scoringConfigs: scores.rows,
  };
}

export async function getPerformanceComparisonData(
  userId: string,
  projectId: string,
  reviewId: string,
) {
  await requireCanReadProject(userId, projectId);
  const reviewResult = await query(
    `select * from public.performance_reviews where id = $1::uuid and project_id = $2::uuid limit 1`,
    [reviewId, projectId],
  );
  const review = reviewResult.rows[0];
  if (!review) throw new HttpError(404, "not_found", "Avaliacao nao encontrada.");

  const [participants, comments, history, weights, scores, canManage] = await Promise.all([
    query(
      `select * from public.performance_review_participants where review_id = $1::uuid order by created_at`,
      [reviewId],
    ),
    query(
      `select * from public.performance_review_comments where review_id = $1::uuid order by created_at`,
      [reviewId],
    ),
    query(
      `select * from public.performance_answer_history where review_id = $1::uuid order by changed_at desc`,
      [reviewId],
    ),
    query(
      `select career_key, career_label, weights from public.evaluation_weight_configs where project_id = $1::uuid`,
      [projectId],
    ),
    query(
      `select criterion_key, scoring_schema from public.criterion_scoring_configs where project_id = $1::uuid`,
      [projectId],
    ),
    canUsePerformanceManager(userId, projectId),
  ]);
  const authorIds = Array.from(
    new Set([
      ...comments.rows.map((row) => row.author_id as string),
      ...(history.rows.map((row) => row.changed_by as string | null).filter(Boolean) as string[]),
    ]),
  );
  const authors = authorIds.length
    ? await query<{ id: string; nome: string }>(
        `select id, nome from public.profiles where id = any($1::uuid[])`,
        [authorIds],
      )
    : { rows: [] as Array<{ id: string; nome: string }> };

  return {
    review,
    participants: participants.rows,
    comments: comments.rows,
    history: history.rows,
    weightConfigs: weights.rows,
    scoringConfigs: scores.rows,
    authors: Object.fromEntries(authors.rows.map((row) => [row.id, row.nome])),
    canManage,
  };
}

export async function listPerformanceConfigs(
  userId: string,
  projectId: string | null,
  ensureDefaults = false,
) {
  await requireCanManageConfigScope(userId, projectId);
  if (ensureDefaults) {
    await query(
      `
        insert into public.performance_review_configs
          (project_id, name, period_days, review_type, questions_schema, is_active, created_by)
        select $2::uuid, defaults.name, 90, defaults.review_type, defaults.questions_schema::jsonb, true, $1::uuid
          from jsonb_to_recordset($3::jsonb) as defaults(name text, review_type text, questions_schema jsonb)
         where not exists (
           select 1 from public.performance_review_configs cfg
            where cfg.project_id is not distinct from $2::uuid
              and cfg.review_type = defaults.review_type
         )
      `,
      [
        userId,
        projectId,
        JSON.stringify([
          { name: "Avaliacao de experiencia", review_type: "experience", questions_schema: [] },
          { name: "Avaliacao de desempenho", review_type: "performance", questions_schema: [] },
        ]),
      ],
    );
  }
  const result = await query(
    `select * from public.performance_review_configs where project_id is not distinct from $1::uuid order by period_days`,
    [projectId],
  );
  return result.rows;
}

export async function createMissingPerformanceConfigs(args: {
  actorUserId: string;
  projectId: string | null;
  configs: Array<{
    name: string;
    reviewType: ReviewType;
    periodDays: number;
    questionsSchema: JsonValue;
    isActive: boolean;
  }>;
}) {
  await requireCanManageConfigScope(args.actorUserId, args.projectId);
  await withTransaction(async (client) => {
    for (const config of args.configs) {
      await client.query(
        `
          insert into public.performance_review_configs
            (project_id, name, period_days, review_type, questions_schema, is_active, created_by)
          select $1::uuid, $2, $3, $4, $5::jsonb, $6, $7::uuid
           where not exists (
             select 1 from public.performance_review_configs
              where project_id is not distinct from $1::uuid and review_type = $4
           )
        `,
        [
          args.projectId,
          config.name.trim(),
          config.periodDays,
          config.reviewType,
          JSON.stringify(config.questionsSchema),
          config.isActive,
          args.actorUserId,
        ],
      );
    }
  });
  return listPerformanceConfigs(args.actorUserId, args.projectId);
}

export async function savePerformanceConfig(args: {
  actorUserId: string;
  projectId: string | null;
  configId: string;
  name: string;
  periodDays: number;
  reviewType: ReviewType;
  questionsSchema: JsonValue;
  isActive: boolean;
}) {
  await requireCanManageConfigScope(args.actorUserId, args.projectId);
  const result = await query(
    `
      update public.performance_review_configs
         set name = $3, period_days = $4, review_type = $5,
             questions_schema = $6::jsonb, is_active = $7
       where id = $1::uuid and project_id is not distinct from $2::uuid
       returning *
    `,
    [
      args.configId,
      args.projectId,
      args.name.trim(),
      args.periodDays,
      args.reviewType,
      JSON.stringify(args.questionsSchema),
      args.isActive,
    ],
  );
  if (!result.rowCount) throw new HttpError(404, "not_found", "Modelo nao encontrado.");
  return result.rows[0];
}

export async function saveEvaluationWeights(args: {
  actorUserId: string;
  projectId: string;
  rows: Array<{ careerKey: string; careerLabel: string; weights: Record<string, number> }>;
}) {
  await requireCanManageProject(args.actorUserId, args.projectId);
  for (const row of args.rows) {
    const values = Object.values(row.weights);
    if (values.some((value) => !Number.isFinite(value) || value < 0 || value > 100)) {
      throw new HttpError(400, "invalid_weights", "Os pesos devem estar entre 0 e 100.");
    }
    if (Math.abs(values.reduce((sum, value) => sum + value, 0) - 100) >= 0.01) {
      throw new HttpError(400, "invalid_weights", "Os pesos de cada carreira devem totalizar 100.");
    }
  }
  await withTransaction(async (client) => {
    for (const row of args.rows) {
      await client.query(
        `
          insert into public.evaluation_weight_configs
            (project_id, career_key, career_label, weights, created_by)
          values ($1::uuid, $2, $3, $4::jsonb, $5::uuid)
          on conflict (project_id, career_key) do update
            set career_label = excluded.career_label, weights = excluded.weights
        `,
        [
          args.projectId,
          row.careerKey.trim(),
          row.careerLabel.trim(),
          JSON.stringify(row.weights),
          args.actorUserId,
        ],
      );
    }
  });
}

export async function saveCriterionScoring(args: {
  actorUserId: string;
  projectId: string;
  criterionKey: string;
  scoringSchema: Array<{ id: string; label: string; score: number | null; notApplicable: boolean }>;
}) {
  await requireCanManageProject(args.actorUserId, args.projectId);
  if (
    args.scoringSchema.some((rule) => rule.score !== null && (rule.score < 0 || rule.score > 100))
  ) {
    throw new HttpError(400, "invalid_scores", "As pontuacoes devem estar entre 0 e 100.");
  }
  await query(
    `
      insert into public.criterion_scoring_configs
        (project_id, criterion_key, scoring_schema, created_by)
      values ($1::uuid, $2, $3::jsonb, $4::uuid)
      on conflict (project_id, criterion_key) do update
        set scoring_schema = excluded.scoring_schema
    `,
    [
      args.projectId,
      args.criterionKey.trim(),
      JSON.stringify(args.scoringSchema),
      args.actorUserId,
    ],
  );
}

type CreateReviewInput = {
  configId: string;
  employeeId: string;
  leaderEmployeeId: string;
  jobDescriptionId: string;
  name: string;
  periodName: string;
  periodDays: number;
  dueDate: string | null;
  reviewType: ReviewType;
  jobDescriptionSnapshot: JsonValue;
  activitiesSnapshot: JsonValue;
  questionsSnapshot: JsonValue;
  evaluationWeightsSnapshot: JsonValue;
  criterionScoringSnapshot: JsonValue;
  expiresAt: string;
};

export async function createPerformanceReview(args: {
  actorUserId: string;
  projectId: string;
  input: CreateReviewInput;
}) {
  await requireCanManageProject(args.actorUserId, args.projectId);
  return withTransaction(async (client) => {
    const relation = await client.query<{
      employee_position_id: string;
      employee_name: string;
      leader_position_id: string;
      leader_name: string;
      job_title: string;
    }>(
      `
        select employee.position_id as employee_position_id,
               employee.nome as employee_name,
               leader.position_id as leader_position_id,
               leader.nome as leader_name,
               coalesce(dc.cargo, employee_position.nome) as job_title
          from public.project_employees employee
          join public.project_employees leader
            on leader.id = $3::uuid and leader.project_id = employee.project_id
          join public.project_positions employee_position
            on employee_position.id = employee.position_id and employee_position.project_id = employee.project_id
          join public.project_positions leader_position
            on leader_position.id = leader.position_id and leader_position.project_id = employee.project_id
          join public.descricoes_cargo dc
            on dc.id = $4::uuid and dc.project_id = employee.project_id
           and dc.organization_position_id = employee.position_id
          join public.performance_review_configs cfg
            on cfg.id = $5::uuid and cfg.project_id = employee.project_id and cfg.is_active = true
         where employee.id = $2::uuid
           and employee.project_id = $1::uuid
           and employee.superior_imediato_id = leader.id
           and cfg.review_type = $6
         limit 1
      `,
      [
        args.projectId,
        args.input.employeeId,
        args.input.leaderEmployeeId,
        args.input.jobDescriptionId,
        args.input.configId,
        args.input.reviewType,
      ],
    );
    const canonical = relation.rows[0];
    if (!canonical) {
      throw new HttpError(
        400,
        "invalid_review_relationships",
        "Colaborador, lider, cargo ou modelo invalido para este projeto.",
      );
    }
    const reviewResult = await client.query<{ id: string }>(
      `
        insert into public.performance_reviews (
          project_id, config_id, employee_id, name, employee_position_id, leader_position_id,
          job_description_id, employee_name, leader_name, job_title, period_name, period_days,
          due_date, review_type, job_description_snapshot, activities_snapshot, questions_snapshot,
          evaluation_weights_snapshot, criterion_scoring_snapshot, created_by
        ) values (
          $1::uuid, $2::uuid, $3::uuid, $4, $5::uuid, $6::uuid, $7::uuid, $8, $9, $10,
          $11, $12, $13::date, $14, $15::jsonb, $16::jsonb, $17::jsonb, $18::jsonb, $19::jsonb, $20::uuid
        ) returning id
      `,
      [
        args.projectId,
        args.input.configId,
        args.input.employeeId,
        args.input.name.trim(),
        canonical.employee_position_id,
        canonical.leader_position_id,
        args.input.jobDescriptionId,
        canonical.employee_name,
        canonical.leader_name,
        canonical.job_title,
        args.input.periodName,
        args.input.periodDays,
        args.input.dueDate,
        args.input.reviewType,
        JSON.stringify(args.input.jobDescriptionSnapshot),
        JSON.stringify(args.input.activitiesSnapshot),
        JSON.stringify(args.input.questionsSnapshot),
        JSON.stringify(args.input.evaluationWeightsSnapshot),
        JSON.stringify(args.input.criterionScoringSnapshot),
        args.actorUserId,
      ],
    );
    const reviewId = reviewResult.rows[0].id;
    await client.query(
      `
        insert into public.performance_review_participants
          (review_id, project_id, participant_type, expires_at)
        values
          ($1::uuid, $2::uuid, 'collaborator', $3::timestamptz),
          ($1::uuid, $2::uuid, 'leader', $3::timestamptz)
      `,
      [reviewId, args.projectId, args.input.expiresAt],
    );
    return { id: reviewId };
  });
}

async function lockReviewForManage(
  client: PoolClient,
  actorUserId: string,
  projectId: string,
  reviewId: string,
) {
  const result = await client.query<{
    id: string;
    status: string;
    employee_id: string | null;
    due_date: string | null;
  }>(
    `select id, status::text, employee_id, due_date from public.performance_reviews where id = $1::uuid and project_id = $2::uuid for update`,
    [reviewId, projectId],
  );
  if (!result.rows[0]) throw new HttpError(404, "not_found", "Avaliacao nao encontrada.");
  await requireCanManageProject(actorUserId, projectId);
  return result.rows[0];
}

export async function addPerformanceComment(args: {
  actorUserId: string;
  projectId: string;
  reviewId: string;
  questionKey: string;
  content: string;
}) {
  await requireCanReadProject(args.actorUserId, args.projectId);
  const result = await query(
    `
      insert into public.performance_review_comments (review_id, question_key, author_id, content)
      select id, $3, $4::uuid, $5
        from public.performance_reviews
       where id = $1::uuid and project_id = $2::uuid and status <> 'finalized'
      returning *
    `,
    [args.reviewId, args.projectId, args.questionKey.trim(), args.actorUserId, args.content.trim()],
  );
  if (!result.rowCount)
    throw new HttpError(409, "review_locked", "Avaliacao finalizada ou inexistente.");
  return result.rows[0];
}

export async function updatePerformanceAnswer(args: {
  actorUserId: string;
  projectId: string;
  reviewId: string;
  participantId: string;
  questionKey: string;
  nextAnswer: string;
}) {
  await requireCanManageProject(args.actorUserId, args.projectId);
  return withTransaction(async (client) => {
    const review = await lockReviewForManage(
      client,
      args.actorUserId,
      args.projectId,
      args.reviewId,
    );
    if (review.status === "finalized")
      throw new HttpError(409, "review_locked", "Avaliacao finalizada.");
    const participant = await client.query<{ response_answers: Record<string, string> }>(
      `select response_answers from public.performance_review_participants where id = $1::uuid and review_id = $2::uuid and project_id = $3::uuid for update`,
      [args.participantId, args.reviewId, args.projectId],
    );
    if (!participant.rows[0]) throw new HttpError(404, "not_found", "Participante nao encontrado.");
    const currentAnswers = participant.rows[0].response_answers ?? {};
    const previousAnswer = currentAnswers[args.questionKey] ?? "";
    if (previousAnswer === args.nextAnswer) return;
    await client.query(
      `update public.performance_review_participants set response_answers = $2::jsonb where id = $1::uuid`,
      [
        args.participantId,
        JSON.stringify({ ...currentAnswers, [args.questionKey]: args.nextAnswer }),
      ],
    );
    await client.query(
      `insert into public.performance_answer_history (participant_id, review_id, question_key, previous_answer, new_answer, changed_by) values ($1::uuid, $2::uuid, $3, $4, $5, $6::uuid)`,
      [
        args.participantId,
        args.reviewId,
        args.questionKey,
        previousAnswer,
        args.nextAnswer,
        args.actorUserId,
      ],
    );
  });
}

export async function finalizePerformanceReview(args: {
  actorUserId: string;
  projectId: string;
  reviewId: string;
  managementOpinion?: string;
  scoreSummary?: JsonValue;
  evaluationWeights?: JsonValue;
  criterionScoring?: JsonValue;
}) {
  await requireCanManageProject(args.actorUserId, args.projectId);
  await withTransaction(async (client) => {
    const review = await lockReviewForManage(
      client,
      args.actorUserId,
      args.projectId,
      args.reviewId,
    );
    const counts = await client.query<{ total: number; answered: number }>(
      `select count(*)::int as total, count(*) filter (where status = 'answered')::int as answered from public.performance_review_participants where review_id = $1::uuid`,
      [args.reviewId],
    );
    if (counts.rows[0]?.total !== 2 || counts.rows[0]?.answered !== 2) {
      throw new HttpError(
        409,
        "responses_pending",
        "A avaliacao so pode ser finalizada depois das duas respostas.",
      );
    }
    await client.query(
      `
        update public.performance_reviews
           set status = 'finalized', management_opinion = coalesce($2, management_opinion),
               score_summary_snapshot = coalesce($3::jsonb, score_summary_snapshot),
               evaluation_weights_snapshot = coalesce($4::jsonb, evaluation_weights_snapshot),
               criterion_scoring_snapshot = coalesce($5::jsonb, criterion_scoring_snapshot),
               finalized_by = $6::uuid, finalized_at = now()
         where id = $1::uuid
      `,
      [
        args.reviewId,
        args.managementOpinion?.trim() || null,
        args.scoreSummary === undefined ? null : JSON.stringify(args.scoreSummary),
        args.evaluationWeights === undefined ? null : JSON.stringify(args.evaluationWeights),
        args.criterionScoring === undefined ? null : JSON.stringify(args.criterionScoring),
        args.actorUserId,
      ],
    );
    if (review.employee_id) {
      await client.query(
        `update public.project_employees set last_performance_review_date = coalesce($3::date, current_date) where id = $1::uuid and project_id = $2::uuid`,
        [review.employee_id, args.projectId, review.due_date],
      );
    }
  });
}

export async function reopenPerformanceReview(args: {
  actorUserId: string;
  projectId: string;
  reviewId: string;
}) {
  await requireCanManageProject(args.actorUserId, args.projectId);
  const result = await query(
    `update public.performance_reviews set status = 'ready_for_comparison', reopened_by = $3::uuid, reopened_at = now(), finalized_by = null, finalized_at = null where id = $1::uuid and project_id = $2::uuid returning id`,
    [args.reviewId, args.projectId, args.actorUserId],
  );
  if (!result.rowCount) throw new HttpError(404, "not_found", "Avaliacao nao encontrada.");
}

export async function markPerformanceLinksSent(args: {
  actorUserId: string;
  projectId: string;
  participantId?: string;
  reviewId?: string;
}) {
  await requireCanManageProject(args.actorUserId, args.projectId);
  const result = await query(
    args.participantId
      ? `update public.performance_review_participants set status = 'sent', sent_at = now() where id = $1::uuid and project_id = $2::uuid and status = 'not_sent' returning id`
      : `update public.performance_review_participants set status = 'sent', sent_at = now() where review_id = $1::uuid and project_id = $2::uuid and status = 'not_sent' returning id`,
    [args.participantId ?? args.reviewId, args.projectId],
  );
  if (!result.rowCount && args.participantId) {
    const exists = await query(
      `select 1 from public.performance_review_participants where id = $1::uuid and project_id = $2::uuid`,
      [args.participantId, args.projectId],
    );
    if (!exists.rowCount) throw new HttpError(404, "not_found", "Participante nao encontrado.");
  }
}
