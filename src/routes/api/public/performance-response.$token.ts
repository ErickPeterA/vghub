import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/performance-response/$token")({
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
          const { withTransaction } = await import("@/server/db/pool");
          const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
          await withTransaction(async (client) => {
            const participantResult = await client.query(
              `select id, review_id, status, expires_at from public.performance_review_participants where token::text = $1 limit 1`,
              [token],
            );
            const participant = participantResult.rows[0];
            if (!participant) throw new Response(JSON.stringify({ error: "not_found", message: "Link nao encontrado." }), { status: 404 });
            if (participant.status === "answered") throw new Response(JSON.stringify({ error: "already_answered", message: "Ja respondido." }), { status: 410 });
            if (new Date(participant.expires_at) < new Date()) throw new Response(JSON.stringify({ error: "expired", message: "Link expirado." }), { status: 410 });

            const review = await client.query(`select status from public.performance_reviews where id = $1::uuid limit 1`, [participant.review_id]);
            if (review.rows[0]?.status === "finalized") throw new Response(JSON.stringify({ error: "finalized", message: "Avaliacao finalizada." }), { status: 410 });

            await client.query(
              `
                update public.performance_review_participants
                   set status = 'answered',
                       response_answers = $2::jsonb,
                       draft_answers = '{}'::jsonb,
                       draft_saved_at = null,
                       submitted_at = now(),
                       submitted_ip = $3::text
                 where id = $1::uuid
              `,
              [participant.id, JSON.stringify(body.answers ?? {}), ip],
            );
            await client.query(`select public.refresh_performance_review_status($1::uuid)`, [participant.review_id]);
          });
          return Response.json({ ok: true });
        } catch (error) {
          if (error instanceof Response) return error;
          console.error(error);
          return Response.json({ error: "server_error", message: "Erro ao enviar resposta." }, { status: 500 });
        }
      },
    },
  },
});
