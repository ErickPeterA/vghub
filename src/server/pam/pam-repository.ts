import { query, withTransaction } from "@/server/db/pool";
import { HttpError } from "@/server/http/errors";
import { requireCanManageProject } from "@/server/projects/project-permissions";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

type PamStatus = "draft" | "released" | "in_progress" | "completed";
type PamItemStatus = "not_started" | "in_progress" | "completed";

type PamPatch = {
  status?: PamStatus;
  released_at?: string | null;
  completed_at?: string | null;
  link_revoked_at?: string | null;
};

export async function getPamPageData(userId: string, projectId: string) {
  await requireCanManageProject(userId, projectId);
  const [reviews, participants, pams, items] = await Promise.all([
    query(
      `
        select id, project_id, employee_id, employee_name, job_title, name, review_type,
               status, finalized_at, due_date, score_summary_snapshot, questions_snapshot
          from public.performance_reviews
         where project_id = $1::uuid
           and status = 'finalized'
         order by finalized_at desc
      `,
      [projectId],
    ),
    query(
      `
        select review_id, participant_type, response_answers
          from public.performance_review_participants
         where project_id = $1::uuid
           and participant_type = 'collaborator'
      `,
      [projectId],
    ),
    query(
      `
        select *
          from public.pam
         where project_id = $1::uuid
         order by created_at desc
      `,
      [projectId],
    ),
    query(
      `
        select pi.*
          from public.pam_items pi
          join public.pam p on p.id = pi.pam_id
         where p.project_id = $1::uuid
         order by pi.display_order asc
      `,
      [projectId],
    ),
  ]);

  return {
    reviews: reviews.rows,
    participants: participants.rows,
    pams: pams.rows,
    items: items.rows,
  };
}

export async function createPam(input: {
  actorUserId: string;
  projectId: string;
  reviewId: string;
  employeeId: string | null;
  employeeName: string;
  jobTitle: string | null;
  feedbackDate: string | null;
  items: Array<{
    source: string;
    source_key: string | null;
    source_score: number | null;
    improvement_point: string;
    skill_label: string | null;
    display_order: number;
  }>;
}) {
  await requireCanManageProject(input.actorUserId, input.projectId);
  return withTransaction(async (client) => {
    const pamResult = await client.query(
      `
        insert into public.pam (
          project_id,
          employee_id,
          review_id,
          employee_name,
          job_title,
          feedback_date,
          status,
          created_by
        )
        values ($1::uuid, $2::uuid, $3::uuid, $4::text, $5::text, $6::date, 'draft', $7::uuid)
        returning *
      `,
      [
        input.projectId,
        input.employeeId,
        input.reviewId,
        input.employeeName,
        input.jobTitle,
        input.feedbackDate,
        input.actorUserId,
      ],
    );
    const pam = pamResult.rows[0];

    for (const item of input.items) {
      await client.query(
        `
          insert into public.pam_items (
            pam_id,
            source,
            source_key,
            source_score,
            improvement_point,
            skill_label,
            display_order
          )
          values ($1::uuid, $2::text, $3::text, $4::numeric, $5::text, $6::text, $7::integer)
        `,
        [
          pam.id,
          item.source,
          item.source_key,
          item.source_score,
          item.improvement_point,
          item.skill_label,
          item.display_order,
        ],
      );
    }

    return pam;
  });
}

export async function addPamItem(input: {
  actorUserId: string;
  projectId: string;
  pamId: string;
  source: string;
  improvementPoint: string;
  skillLabel: string | null;
  displayOrder: number;
}) {
  await requireCanManageProject(input.actorUserId, input.projectId);
  const result = await query(
    `
      insert into public.pam_items (
        pam_id,
        source,
        improvement_point,
        skill_label,
        display_order
      )
      select p.id, $3::text, $4::text, $5::text, $6::integer
        from public.pam p
       where p.id = $1::uuid
         and p.project_id = $2::uuid
      returning public.pam_items.*
    `,
    [
      input.pamId,
      input.projectId,
      input.source,
      input.improvementPoint,
      input.skillLabel,
      input.displayOrder,
    ],
  );
  if (!result.rows[0]) throw new HttpError(404, "not_found", "PAM nao encontrado.");
  return result.rows[0];
}

export async function deletePamItem(input: {
  actorUserId: string;
  projectId: string;
  itemId: string;
}) {
  await requireCanManageProject(input.actorUserId, input.projectId);
  const result = await query(
    `
      delete from public.pam_items pi
       using public.pam p
       where pi.id = $1::uuid
         and p.id = pi.pam_id
         and p.project_id = $2::uuid
      returning pi.id
    `,
    [input.itemId, input.projectId],
  );
  if (!result.rows[0]) throw new HttpError(404, "not_found", "Item nao encontrado.");
}

export async function updatePam(input: {
  actorUserId: string;
  projectId: string;
  pamId: string;
  patch: PamPatch;
}) {
  await requireCanManageProject(input.actorUserId, input.projectId);
  const result = await query(
    `
      update public.pam
         set status = coalesce($3::public.pam_status, status),
             released_at = case when $4::boolean then $5::timestamptz else released_at end,
             completed_at = case when $6::boolean then $7::timestamptz else completed_at end,
             link_revoked_at = case when $8::boolean then $9::timestamptz else link_revoked_at end
       where id = $1::uuid
         and project_id = $2::uuid
       returning *
    `,
    [
      input.pamId,
      input.projectId,
      input.patch.status ?? null,
      Object.prototype.hasOwnProperty.call(input.patch, "released_at"),
      input.patch.released_at ?? null,
      Object.prototype.hasOwnProperty.call(input.patch, "completed_at"),
      input.patch.completed_at ?? null,
      Object.prototype.hasOwnProperty.call(input.patch, "link_revoked_at"),
      input.patch.link_revoked_at ?? null,
    ],
  );
  if (!result.rows[0]) throw new HttpError(404, "not_found", "PAM nao encontrado.");
  return result.rows[0];
}

function assertPublicToken(token: string) {
  if (!token || token.length < 32) {
    throw new HttpError(400, "invalid_token", "Link invalido.");
  }
}

async function getPublicPam(token: string) {
  assertPublicToken(token);
  const result = await query(
    `select * from public.pam where token = $1 limit 1`,
    [token],
  );
  return result.rows[0] as
    | {
        id: string;
        status: PamStatus;
        link_revoked_at: string | null;
        first_accessed_at: string | null;
        employee_name: string;
        job_title: string | null;
        feedback_date: string | null;
        completed_at: string | null;
      }
    | undefined;
}

function assertPublicPamAccessible(
  pam:
    | {
        status: PamStatus;
        link_revoked_at: string | null;
      }
    | undefined,
) {
  if (!pam) throw new HttpError(404, "not_found", "Link nao encontrado.");
  if (pam.link_revoked_at) throw new HttpError(410, "revoked", "Link revogado.");
  if (pam.status === "draft") throw new HttpError(403, "not_released", "PAM nao liberado.");
}

function itemFilled(item: {
  problem_reason?: string | null;
  improvement_plan?: string | null;
  evidence_plan?: string | null;
}) {
  return Boolean(
    item.problem_reason?.trim() && item.improvement_plan?.trim() && item.evidence_plan?.trim(),
  );
}

export async function getPublicPamPageData(token: string) {
  const pam = await getPublicPam(token);
  assertPublicPamAccessible(pam);

  const status = pam!.status;
  if (status === "released") {
    await query(
      `
        update public.pam
           set status = 'in_progress',
               first_accessed_at = coalesce(first_accessed_at, now())
         where id = $1::uuid
      `,
      [pam!.id],
    );
  } else if (!pam!.first_accessed_at) {
    await query(`update public.pam set first_accessed_at = now() where id = $1::uuid`, [pam!.id]);
  }

  const items = await query(
    `
      select *
        from public.pam_items
       where pam_id = $1::uuid
       order by display_order asc
    `,
    [pam!.id],
  );

  return {
    pam: {
      id: pam!.id,
      employeeName: pam!.employee_name,
      jobTitle: pam!.job_title,
      feedbackDate: pam!.feedback_date,
      status: status === "released" ? "in_progress" : status,
      completedAt: pam!.completed_at,
    },
    editable: status !== "completed",
    items: items.rows,
  };
}

export async function savePublicPamDraft(input: {
  token: string;
  itemId: string;
  problemReason: string;
  improvementPlan: string;
  evidencePlan: string;
  reviewDate: string | null;
  status: PamItemStatus;
}) {
  return withTransaction(async (client) => {
    const pam = await getPublicPam(input.token);
    assertPublicPamAccessible(pam);
    if (pam!.status === "completed") {
      throw new HttpError(410, "completed", "PAM concluido. Edicao bloqueada.");
    }

    const result = await client.query(
      `
        update public.pam_items
           set problem_reason = $3::text,
               improvement_plan = $4::text,
               evidence_plan = $5::text,
               review_date = $6::date,
               status = $7::public.pam_item_status
         where id = $1::uuid
           and pam_id = $2::uuid
        returning id
      `,
      [
        input.itemId,
        pam!.id,
        input.problemReason,
        input.improvementPlan,
        input.evidencePlan,
        input.reviewDate,
        input.status,
      ],
    );
    if (!result.rows[0]) throw new HttpError(404, "not_found", "Item nao encontrado.");

    if (pam!.status === "released") {
      await client.query(`update public.pam set status = 'in_progress' where id = $1::uuid`, [
        pam!.id,
      ]);
    }

    return { savedAt: new Date().toISOString() };
  });
}

export async function completePublicPam(token: string) {
  return withTransaction(async (client) => {
    const pam = await getPublicPam(token);
    assertPublicPamAccessible(pam);
    if (pam!.status === "completed") return { completedAt: pam!.completed_at };

    const items = await client.query(
      `
        select id, problem_reason, improvement_plan, evidence_plan
          from public.pam_items
         where pam_id = $1::uuid
      `,
      [pam!.id],
    );

    if (!items.rows.length || !items.rows.every(itemFilled)) {
      throw new HttpError(400, "incomplete", "Preencha todos os pontos antes de concluir.");
    }

    const completedAt = new Date().toISOString();
    await client.query(
      `update public.pam_items set status = 'completed' where pam_id = $1::uuid`,
      [pam!.id],
    );
    await client.query(
      `
        update public.pam
           set status = 'completed',
               completed_at = $2::timestamptz
         where id = $1::uuid
      `,
      [pam!.id, completedAt],
    );
    return { completedAt };
  });
}
