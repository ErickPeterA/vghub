import { createFileRoute } from "@tanstack/react-router";

type PerformanceQuestion = {
  id: string;
  label: string;
  type: "text" | "textarea" | "select";
  required: boolean;
  active?: boolean;
  options?: string[];
  helpText?: string;
  source?: "activity" | "config";
};

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
          .select("id,review_id,participant_type,status,expires_at,draft_answers,draft_saved_at")
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
            "id,name,status,employee_name,leader_name,job_title,activities_snapshot,questions_snapshot",
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
          ...((review.activities_snapshot as PerformanceQuestion[] | null) ?? []),
          ...((review.questions_snapshot as PerformanceQuestion[] | null) ?? []),
        ].filter((question) => question.active ?? true);

        return Response.json({
          ok: true,
          reviewName: review.name,
          participantType: participant.participant_type,
          employeeName: review.employee_name,
          leaderName: review.leader_name,
          jobTitle: review.job_title,
          draftAnswers: participant.draft_answers ?? {},
          draftSavedAt: participant.draft_saved_at,
          questions,
        });
      },
    },
  },
});
