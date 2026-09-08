import { createFileRoute } from "@tanstack/react-router";

const dcPayloadSchema = async () => {
  const { z } = await import("zod");
  return z.object({
    cargo: z.string().min(1),
    unidade_negocio: z.string().nullable(),
    departamento: z.string().nullable(),
    nivelamento: z.string().nullable(),
    superior_imediato: z.string().nullable(),
    tipo_carreira: z.string().nullable(),
    data_versao: z.string().nullable(),
    data_revisao: z.string().nullable(),
    status: z.string(),
    objetivo: z.string().nullable(),
    instrucao: z.unknown(),
    experiencia: z.unknown(),
    conhecimento: z.unknown(),
    atividades: z.unknown(),
    indicadores: z.unknown(),
    habilidades_cargo: z.unknown(),
    habilidades_culturais: z.unknown(),
    postura: z.unknown(),
    dynamic_values: z.unknown(),
    organization_position_id: z.string().uuid().nullable(),
  });
};

export const Route = createFileRoute("/api/projects/$projectId/dc")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const [{ requireAuthenticatedUser }, { requireLocalUser }, repo] = await Promise.all([
            import("@/server/auth/session"),
            import("@/server/auth/local-user"),
            import("@/server/dc/dc-repository"),
          ]);
          const user = await requireAuthenticatedUser(request);
          await requireLocalUser(user.userId);
          const url = new URL(request.url);
          const mode = url.searchParams.get("mode");
          const positionId = url.searchParams.get("positionId");

          if (mode === "progress") {
            return Response.json({
              ok: true,
              rows: await repo.getDcProgressRows(user.userId, params.projectId),
            });
          }
          if (mode === "position-description" && positionId) {
            return Response.json({
              ok: true,
              description: await repo.getPositionDescription(user.userId, params.projectId, positionId),
            });
          }
          if (mode === "linked-position" && positionId) {
            return Response.json({
              ok: true,
              position: await repo.getLinkedPositionData(user.userId, params.projectId, positionId),
            });
          }

          return Response.json({
            ok: true,
            ...(await repo.getDcListPageData(user.userId, params.projectId)),
          });
        } catch (error) {
          const { toErrorResponse } = await import("@/server/http/errors");
          return toErrorResponse(error);
        }
      },
      POST: async ({ request, params }) => {
        try {
          const [{ requireAuthenticatedUser }, { requireLocalUser }, { createDc }] =
            await Promise.all([
              import("@/server/auth/session"),
              import("@/server/auth/local-user"),
              import("@/server/dc/dc-repository"),
            ]);
          const schema = await dcPayloadSchema();
          const payload = schema.parse(await request.json().catch(() => null));
          const user = await requireAuthenticatedUser(request);
          await requireLocalUser(user.userId);
          const dc = await createDc({ actorUserId: user.userId, projectId: params.projectId, payload });
          return Response.json({ ok: true, dc }, { status: 201 });
        } catch (error) {
          const { toErrorResponse } = await import("@/server/http/errors");
          return toErrorResponse(error);
        }
      },
    },
  },
});
