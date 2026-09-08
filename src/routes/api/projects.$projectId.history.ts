import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/projects/$projectId/history")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const [
            { requireAuthenticatedUser },
            { requireLocalUser },
            { getProjectHistoryPageData },
          ] = await Promise.all([
            import("@/server/auth/session"),
            import("@/server/auth/local-user"),
            import("@/server/history/history-repository"),
          ]);
          const user = await requireAuthenticatedUser(request);
          await requireLocalUser(user.userId);
          return Response.json({
            ok: true,
            ...(await getProjectHistoryPageData(user.userId, params.projectId)),
          });
        } catch (error) {
          const { toErrorResponse } = await import("@/server/http/errors");
          return toErrorResponse(error);
        }
      },
      POST: async ({ request, params }) => {
        try {
          const [{ z }, { requireAuthenticatedUser }, { requireLocalUser }, { logProjectAction }] =
            await Promise.all([
              import("zod"),
              import("@/server/auth/session"),
              import("@/server/auth/local-user"),
              import("@/server/history/history-repository"),
            ]);
          const body = await request.json().catch(() => null);
          const input = z
            .object({
              acao: z.string().min(1),
              entidade: z.string().nullable().optional(),
              entidadeId: z.string().uuid().nullable().optional(),
              detalhes: z.unknown().optional(),
            })
            .parse(body);
          const user = await requireAuthenticatedUser(request);
          await requireLocalUser(user.userId);
          await logProjectAction({
            actorUserId: user.userId,
            projectId: params.projectId,
            acao: input.acao,
            entidade: input.entidade ?? null,
            entidadeId: input.entidadeId ?? null,
            detalhes: input.detalhes ?? {},
          });
          return Response.json({ ok: true }, { status: 201 });
        } catch (error) {
          const { toErrorResponse } = await import("@/server/http/errors");
          return toErrorResponse(error);
        }
      },
    },
  },
});
