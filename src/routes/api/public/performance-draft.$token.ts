import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/performance-draft/$token")({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
        const token = params.token;
        if (!token || token.length < 20) {
          return Response.json({ error: "invalid_token", message: "Link invalido." }, { status: 400 });
        }

        let body: { answers?: Record<string, string> };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "invalid_body", message: "Payload invalido." }, { status: 400 });
        }

        try {
          const { query } = await import("@/server/db/pool");
          const participantResult = await query(
            `select id, review_id, status, expires_at from public.performance_review_participants where token::text = $1 limit 1`,
            [token],
          );
          const participant = participantResult.rows[0];
          if (!participant) return Response.json({ error: "not_found", message: "Link nao encontrado." }, { status: 404 });
          if (participant.status === "answered") return Response.json({ error: "already_answered", message: "Ja respondido." }, { status: 410 });
          if (new Date(participant.expires_at) < new Date()) return Response.json({ error: "expired", message: "Link expirado." }, { status: 410 });

          const review = await query(`select status from public.performance_reviews where id = $1::uuid limit 1`, [participant.review_id]);
          if (review.rows[0]?.status === "finalized") return Response.json({ error: "finalized", message: "Avaliacao finalizada." }, { status: 410 });

          const savedAt = new Date().toISOString();
          await query(
            `
              update public.performance_review_participants
                 set draft_answers = $2::jsonb,
                     draft_saved_at = $3::timestamptz,
                     status = 'in_progress'
               where id = $1::uuid
            `,
            [participant.id, JSON.stringify(body.answers ?? {}), savedAt],
          );
          return Response.json({ ok: true, savedAt });
        } catch (error) {
          console.error(error);
          return Response.json({ error: "server_error", message: "Erro ao salvar rascunho." }, { status: 500 });
        }
      },
    },
  },
});
