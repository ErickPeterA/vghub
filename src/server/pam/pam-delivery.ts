import { query } from "@/server/db/pool";
import { HttpError } from "@/server/http/errors";
import { createGmailHtmlDraft } from "@/server/gmail/gmail-service";
import { requireCanManageProject } from "@/server/projects/project-permissions";
import { completePublicPam } from "@/server/pam/pam-repository";
import { createPamPdf, safePamFilename } from "@/server/pam/pam-pdf";

type DeliveryPam = {
  id: string;
  employee_name: string;
  job_title: string | null;
  feedback_date: string | null;
  completed_at: string | null;
  pdf_data: Buffer | null;
  pdf_filename: string | null;
};

async function load(token: string) {
  const result = await query<DeliveryPam>(
    `select p.id, p.employee_name, p.job_title, p.feedback_date, p.completed_at, p.pdf_data, p.pdf_filename from public.pam p where p.token = $1 and p.link_revoked_at is null limit 1`,
    [token],
  );
  if (!result.rows[0]) throw new HttpError(404, "not_found", "PAM não encontrado.");
  return result.rows[0];
}

async function ensurePdf(token: string) {
  const pam = await load(token);
  if (pam.pdf_data && pam.pdf_filename) return pam;
  const items = await query(
    `select * from public.pam_items where pam_id = $1::uuid order by display_order`,
    [pam.id],
  );
  const pdf = createPamPdf({
    employeeName: pam.employee_name,
    jobTitle: pam.job_title,
    feedbackDate: pam.feedback_date,
    completedAt: pam.completed_at,
    items: items.rows,
  });
  const filename = safePamFilename(pam.employee_name);
  await query(
    `update public.pam set pdf_data = $2::bytea, pdf_filename = $3, pdf_generated_at = now() where id = $1::uuid`,
    [pam.id, pdf, filename],
  );
  return { ...pam, pdf_data: pdf, pdf_filename: filename };
}

export async function finalizePamAndGeneratePdf(token: string) {
  await completePublicPam(token);
  const pam = await ensurePdf(token);
  return { completedAt: pam.completed_at, pdfGenerated: true };
}

export async function createPamInvitationDraft(input: {
  actorUserId: string;
  projectId: string;
  pamId: string;
  origin: string;
}) {
  await requireCanManageProject(input.actorUserId, input.projectId);
  const result = await query<{
    token: string;
    employee_name: string;
    employee_email: string | null;
    due_date: string | Date | null;
  }>(
    `select p.token, p.employee_name, employee.email as employee_email, review.due_date
       from public.pam p
       left join public.project_employees employee
         on employee.id = p.employee_id and employee.project_id = p.project_id
       left join public.performance_reviews review on review.id = p.review_id
      where p.id = $1::uuid and p.project_id = $2::uuid
      limit 1`,
    [input.pamId, input.projectId],
  );
  const pam = result.rows[0];
  if (!pam) throw new HttpError(404, "not_found", "PAM não encontrado.");
  if (!pam.employee_email?.trim()) {
    throw new HttpError(400, "missing_email", "O colaborador não possui e-mail cadastrado.");
  }

  const link = `${input.origin.replace(/\/$/, "")}/pam/${pam.token}`;
  const expirationDate = formatPamDueDate(pam.due_date);
  const name = escapeHtml(pam.employee_name);
  const safeLink = escapeHtml(link);
  const safeDate = escapeHtml(expirationDate);
  const text = `Olá, ${pam.employee_name}!\n\nNesta etapa, você irá elaborar um Plano de Ação de Melhorias (PAM) para as competências e categorias da Avaliação de Desempenho que ainda necessitam de desenvolvimento.\n\nSegue o link para preenchimento:\n\n${link}\n\nDurante o preenchimento, reflita sobre seus pontos fortes e sobre os aspectos que podem ser aprimorados.\n\nPeço, por gentileza, que o preenchimento seja realizado até o dia ${expirationDate}. Fico à disposição para eventuais dúvidas!\n\nApós concluir o preenchimento, por favor, responda a este e-mail confirmando a finalização. Agradecemos sua colaboração.`;
  const html = `<p>Olá, ${name}!</p><p>Nesta etapa, você irá elaborar um <strong>Plano de Ação de Melhorias (PAM)</strong> para as competências e categorias da Avaliação de Desempenho que ainda necessitam de desenvolvimento.</p><p>Segue o link para preenchimento:</p><p><a href="${safeLink}">Link PAM</a></p><p>Durante o preenchimento, reflita sobre seus pontos fortes e sobre os aspectos que podem ser aprimorados.</p><p>Peço, por gentileza, que o preenchimento seja realizado até o dia <strong>${safeDate}</strong>. Fico à disposição para eventuais dúvidas!</p><p>Após concluir o preenchimento, por favor, responda a este e-mail confirmando a finalização. Agradecemos sua colaboração.</p>`;
  let draftId: string;
  try {
    draftId = await createGmailHtmlDraft({
      to: pam.employee_email.trim(),
      subject: `Plano de Ação para Melhoria - ${pam.employee_name}`,
      text,
      html,
    });
  } catch (error) {
    console.error("Failed to create PAM invitation draft", error);
    throw new HttpError(
      502,
      "gmail_draft_failed",
      "Não foi possível criar o rascunho no Gmail. Reconecte a conta e tente novamente.",
    );
  }
  return { draftId };
}

function formatPamDueDate(value: string | Date | null) {
  if (!value) return "(data para expirar o link)";
  const date = value instanceof Date ? value : new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return "(data para expirar o link)";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(date);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return entities[character];
  });
}

export async function getPamPdf(token: string) {
  const pam = await ensurePdf(token);
  return { data: pam.pdf_data!, filename: pam.pdf_filename! };
}
