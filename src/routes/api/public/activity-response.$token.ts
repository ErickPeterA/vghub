import { createFileRoute } from "@tanstack/react-router";

type QuestionAnswers = Record<string, string> | Array<Record<string, string>>;

export const Route = createFileRoute("/api/public/activity-response/$token")({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
        const token = params.token;
        if (!token || token.length < 20) {
          return Response.json({ error: "invalid_token", message: "Link inválido." }, { status: 400 });
        }

        let body: { header_answers?: Record<string, string>; question_answers?: QuestionAnswers };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "invalid_body", message: "Payload inválido." }, { status: 400 });
        }

        const header_answers = body.header_answers ?? {};
        const question_answers = body.question_answers ?? [];

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: link } = await supabaseAdmin
          .from("activity_links")
          .select("id,project_id,status,expires_at,header_answers")
          .eq("token", token)
          .maybeSingle();

        if (!link) return Response.json({ error: "not_found", message: "Link não encontrado." }, { status: 404 });
        if (link.status === "cancelled") return Response.json({ error: "cancelled", message: "Link cancelado." }, { status: 410 });
        if (link.status === "answered") return Response.json({ error: "already_answered", message: "Já respondido." }, { status: 410 });
        if (link.status === "expired" || new Date(link.expires_at) < new Date()) {
          await supabaseAdmin.from("activity_links").update({ status: "expired" }).eq("id", link.id);
          return Response.json({ error: "expired", message: "Link expirado." }, { status: 410 });
        }

        const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

        const { error: insErr } = await supabaseAdmin.from("activity_responses").insert({
          link_id: link.id,
          project_id: link.project_id,
          header_answers: { ...((link.header_answers as Record<string, string> | null) ?? {}), ...header_answers },
          question_answers,
          submitted_ip: ip,
        });
        if (insErr) return Response.json({ error: "server_error", message: insErr.message }, { status: 500 });

        await supabaseAdmin
          .from("activity_links")
          .update({
            status: "answered",
            answered_at: new Date().toISOString(),
            draft_header_answers: {},
            draft_question_answers: [],
            draft_saved_at: null,
          })
          .eq("id", link.id);

        return Response.json({ ok: true });
      },
    },
  },
});
