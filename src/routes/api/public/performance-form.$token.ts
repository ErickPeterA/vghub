import { createFileRoute } from "@tanstack/react-router";

type PerformanceQuestion = {
  id: string;
  label: string;
  leaderLabel?: string;
  type: "text" | "textarea" | "select";
  required: boolean;
  active?: boolean;
  options?: string[];
  leaderOptions?: string[];
  helpText?: string;
  source?: "activity" | "config";
};

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function snapshotValue(snapshot: JsonRecord, key: string) {
  return stringValue(snapshot[key]) ?? stringValue(asRecord(snapshot.dynamic_values)[key]);
}

export const Route = createFileRoute("/api/public/performance-form/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const token = params.token;
        if (!token || token.length < 20) {
          return Response.json(
            { error: "invalid_token", message: "Link inválido." },
            { status: 400 },
          );
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: participant, error } = await supabaseAdmin
          .from("performance_review_participants")
          .select(
            "id,review_id,participant_type,status,expires_at,sent_at,draft_answers,draft_saved_at",
          )
          .eq("token", token)
          .maybeSingle();

        if (error)
          return Response.json(
            { error: "server_error", message: "Erro ao buscar link." },
            { status: 500 },
          );
        if (!participant)
          return Response.json(
            { error: "not_found", message: "Este link não existe ou foi removido." },
            { status: 404 },
          );
        if (participant.status === "answered")
          return Response.json(
            { error: "already_answered", message: "Este formulário já foi respondido. Obrigado!" },
            { status: 410 },
          );
        if (new Date(participant.expires_at) < new Date())
          return Response.json(
            { error: "expired", message: "Este link expirou. Solicite um novo ao responsável." },
            { status: 410 },
          );

        const { data: review } = await supabaseAdmin
          .from("performance_reviews")
          .select(
            "id,project_id,name,status,employee_id,employee_position_id,leader_position_id,employee_name,leader_name,job_title,job_description_snapshot,questions_snapshot,created_at",
          )
          .eq("id", participant.review_id)
          .maybeSingle();

        if (!review)
          return Response.json(
            { error: "not_found", message: "Avaliação não encontrada." },
            { status: 404 },
          );
        if (review.status === "finalized")
          return Response.json(
            { error: "finalized", message: "Esta avaliação já foi finalizada." },
            { status: 410 },
          );

        if (participant.status === "not_sent" || participant.status === "sent") {
          await supabaseAdmin
            .from("performance_review_participants")
            .update({ status: "accessed", accessed_at: new Date().toISOString() })
            .eq("id", participant.id);
        }

        const questions = [
          ...((review.questions_snapshot as PerformanceQuestion[] | null) ?? []),
        ].filter((question) => question.active ?? true);
        const participantRow = participant as typeof participant & {
          sent_at?: string | null;
          expires_at: string;
        };
        const reviewRow = review as typeof review & {
          employee_id?: string | null;
          employee_position_id?: string | null;
          leader_position_id?: string | null;
          job_description_snapshot?: unknown;
        };
        const snapshot = asRecord(reviewRow.job_description_snapshot);

        const [{ data: employee }, { data: employeePosition }, { data: leaderPosition }] =
          await Promise.all([
            reviewRow.employee_id
              ? supabaseAdmin
                  .from("project_employees")
                  .select("admission_date,area_id,sector_id")
                  .eq("id", reviewRow.employee_id)
                  .maybeSingle()
              : Promise.resolve({ data: null }),
            reviewRow.employee_position_id
              ? supabaseAdmin
                  .from("project_positions")
                  .select("nome")
                  .eq("id", reviewRow.employee_position_id)
                  .maybeSingle()
              : Promise.resolve({ data: null }),
            reviewRow.leader_position_id
              ? supabaseAdmin
                  .from("project_positions")
                  .select("nome")
                  .eq("id", reviewRow.leader_position_id)
                  .maybeSingle()
              : Promise.resolve({ data: null }),
          ]);
        const employeeRow = employee as { admission_date?: string; area_id?: string | null; sector_id?: string | null } | null;
        const [{ data: area }, { data: sector }] = await Promise.all([
          employeeRow?.area_id
            ? supabaseAdmin.from("project_areas").select("nome").eq("id", employeeRow.area_id).maybeSingle()
            : Promise.resolve({ data: null }),
          employeeRow?.sector_id
            ? supabaseAdmin.from("project_areas").select("nome").eq("id", employeeRow.sector_id).maybeSingle()
            : Promise.resolve({ data: null }),
        ]);

        const areaName =
          stringValue((area as { nome?: string } | null)?.nome) ??
          snapshotValue(snapshot, "area") ??
          snapshotValue(snapshot, "unidade_negocio");
        const sectorName =
          stringValue((sector as { nome?: string } | null)?.nome) ??
          snapshotValue(snapshot, "setor") ??
          snapshotValue(snapshot, "departamento");
        const areaSector = [areaName, sectorName].filter(Boolean).join(" / ");

        return Response.json({
          ok: true,
          reviewName: review.name,
          participantType: participant.participant_type,
          employeeName: review.employee_name,
          leaderName: review.leader_name,
          jobTitle: review.job_title,
          header: {
            sentAt: participantRow.sent_at ?? null,
            expiresAt: participantRow.expires_at,
            positionName:
              stringValue((employeePosition as { nome?: string } | null)?.nome) ?? review.job_title,
            careerType: snapshotValue(snapshot, "tipo_carreira"),
            areaSector: areaSector || null,
            leaderPositionName:
              stringValue((leaderPosition as { nome?: string } | null)?.nome) ??
              snapshotValue(snapshot, "superior_imediato"),
            employeeName: review.employee_name,
            leaderName: review.leader_name,
            admissionDate: employeeRow?.admission_date ?? null,
          },
          draftAnswers: participant.draft_answers ?? {},
          draftSavedAt: participant.draft_saved_at,
          questions,
        });
      },
    },
  },
});
