import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/performance-response/$token")({
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

        let body: { answers?: Record<string, string> };
        try {
          body = await request.json();
        } catch {
          return Response.json(
            { error: "invalid_body", message: "Payload inválido." },
            { status: 400 },
          );
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: participant } = await supabaseAdmin
          .from("performance_review_participants")
          .select("id,review_id,status,expires_at")
          .eq("token", token)
          .maybeSingle();

        if (!participant)
          return Response.json(
            { error: "not_found", message: "Link não encontrado." },
            { status: 404 },
          );
        if (participant.status === "answered")
          return Response.json(
            { error: "already_answered", message: "Já respondido." },
            { status: 410 },
          );
        if (new Date(participant.expires_at) < new Date())
          return Response.json({ error: "expired", message: "Link expirado." }, { status: 410 });

        const { data: review } = await supabaseAdmin
          .from("performance_reviews")
          .select("status")
          .eq("id", participant.review_id)
          .maybeSingle();
        if (review?.status === "finalized")
          return Response.json(
            { error: "finalized", message: "Avaliação finalizada." },
            { status: 410 },
          );

        const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
        const { error } = await supabaseAdmin
          .from("performance_review_participants")
          .update({
            status: "answered",
            response_answers: body.answers ?? {},
            draft_answers: {},
            draft_saved_at: null,
            submitted_at: new Date().toISOString(),
            submitted_ip: ip,
          })
          .eq("id", participant.id);

        if (error)
          return Response.json({ error: "server_error", message: error.message }, { status: 500 });
        await supabaseAdmin.rpc("refresh_performance_review_status", {
          _review_id: participant.review_id,
        });
        return Response.json({ ok: true });
      },
    },
  },
});
