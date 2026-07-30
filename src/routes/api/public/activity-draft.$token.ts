import { createFileRoute } from "@tanstack/react-router";

type QuestionAnswers = Record<string, string> | Array<Record<string, string>>;

export const Route = createFileRoute("/api/public/activity-draft/$token")({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
        const token = params.token;
        if (!token || token.length < 20) {
          return Response.json(
            { error: "invalid_token", message: "Link inválido." },
            { status: 400 },
          );
        }

        let body: { header_answers?: Record<string, string>; question_answers?: QuestionAnswers };
        try {
          body = await request.json();
        } catch {
          return Response.json(
            { error: "invalid_body", message: "Payload inválido." },
            { status: 400 },
          );
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: link } = await supabaseAdmin
          .from("activity_links")
          .select("id,status,expires_at")
          .eq("token", token)
          .maybeSingle();

        if (!link)
          return Response.json(
            { error: "not_found", message: "Link não encontrado." },
            { status: 404 },
          );
        if (link.status === "cancelled")
          return Response.json({ error: "cancelled", message: "Link cancelado." }, { status: 410 });
        if (link.status === "answered")
          return Response.json(
            { error: "already_answered", message: "Já respondido." },
            { status: 410 },
          );
        if (link.status === "expired" || new Date(link.expires_at) < new Date()) {
          await supabaseAdmin
            .from("activity_links")
            .update({ status: "expired" })
            .eq("id", link.id);
          return Response.json({ error: "expired", message: "Link expirado." }, { status: 410 });
        }

        const savedAt = new Date().toISOString();
        const { error } = await supabaseAdmin
          .from("activity_links")
          .update({
            draft_header_answers: body.header_answers ?? {},
            draft_question_answers: body.question_answers ?? [],
            draft_saved_at: savedAt,
          })
          .eq("id", link.id);

        if (error)
          return Response.json({ error: "server_error", message: error.message }, { status: 500 });
        return Response.json({ ok: true, savedAt });
      },
    },
  },
});
