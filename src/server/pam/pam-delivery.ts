import { query } from "@/server/db/pool";
import { HttpError } from "@/server/http/errors";
import { createGmailDraft } from "@/server/gmail/gmail-service";
import { completePublicPam } from "@/server/pam/pam-repository";
import { createPamPdf, safePamFilename } from "@/server/pam/pam-pdf";

type DeliveryPam = { id: string; employee_name: string; job_title: string | null; feedback_date: string | null; completed_at: string | null; email: string | null; pdf_data: Buffer | null; pdf_filename: string | null; gmail_draft_id: string | null };

async function load(token: string) {
  const result = await query<DeliveryPam>(`select p.id, p.employee_name, p.job_title, p.feedback_date, p.completed_at, e.email, p.pdf_data, p.pdf_filename, p.gmail_draft_id from public.pam p left join public.project_employees e on e.id = p.employee_id and e.project_id = p.project_id where p.token = $1 and p.link_revoked_at is null limit 1`, [token]);
  if (!result.rows[0]) throw new HttpError(404, "not_found", "PAM nao encontrado.");
  return result.rows[0];
}

async function ensurePdf(token: string) {
  const pam = await load(token);
  if (pam.pdf_data && pam.pdf_filename) return pam;
  const items = await query(`select * from public.pam_items where pam_id = $1::uuid order by display_order`, [pam.id]);
  const pdf = createPamPdf({ employeeName: pam.employee_name, jobTitle: pam.job_title, feedbackDate: pam.feedback_date, completedAt: pam.completed_at, items: items.rows });
  const filename = safePamFilename(pam.employee_name);
  await query(`update public.pam set pdf_data = $2::bytea, pdf_filename = $3, pdf_generated_at = now() where id = $1::uuid`, [pam.id, pdf, filename]);
  return { ...pam, pdf_data: pdf, pdf_filename: filename };
}

export async function finalizePamAndCreateDraft(token: string) {
  await completePublicPam(token);
  return createPamDraft(token);
}

export async function createPamDraft(token: string) {
  const pam = await ensurePdf(token);
  if (pam.gmail_draft_id) return { completedAt: pam.completed_at, pdfGenerated: true, gmail: "created", gmailDraftId: pam.gmail_draft_id };
  if (!pam.email?.trim()) return { completedAt: pam.completed_at, pdfGenerated: true, gmail: "missing_email" };
  try {
    const text = `Olá, ${pam.employee_name}!\n\nSegue em anexo o seu Plano de Ação para Melhoria (PAM).\n\nO documento reúne os pontos definidos durante o processo, incluindo os aspectos a serem acompanhados e desenvolvidos ao longo do período.\n\nUtilize este material como referência para acompanhar seus compromissos, ações e evolução.\n\nAtenciosamente,\nVG Resultados`;
    const draftId = await createGmailDraft({ to: pam.email.trim(), subject: `Plano de Ação para Melhoria — ${pam.employee_name}`, text, filename: pam.pdf_filename!, pdf: pam.pdf_data! });
    await query(`update public.pam set gmail_draft_id = $2, gmail_draft_created_at = now() where id = $1::uuid and gmail_draft_id is null`, [pam.id, draftId]);
    return { completedAt: pam.completed_at, pdfGenerated: true, gmail: "created", gmailDraftId: draftId };
  } catch {
    return { completedAt: pam.completed_at, pdfGenerated: true, gmail: "failed" };
  }
}

export async function getPamPdf(token: string) {
  const pam = await ensurePdf(token);
  return { data: pam.pdf_data!, filename: pam.pdf_filename! };
}
