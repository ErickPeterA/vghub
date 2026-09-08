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

export const Route = createFileRoute("/api/projects/$projectId/dc/$dcId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const [{ requireAuthenticatedUser }, { requireLocalUser }, { getDcDetails }] =
            await Promise.all([
            import("@/server/auth/session"),
              import("@/server/auth/local-user"),
              import("@/server/dc/dc-repository"),
            ]);
          const user = await requireAuthenticatedUser(request);
          await requireLocalUser(user.userId);
          return Response.json({
            ok: true,
            ...(await getDcDetails(user.userId, params.projectId, params.dcId)),
          });
        } catch (error) {
          const { toErrorResponse } = await import("@/server/http/errors");
          return toErrorResponse(error);
        }
      },
      PATCH: async ({ request, params }) => {
        try {
          const [{ z }, { requireAuthenticatedUser }, { requireLocalUser }, repo] =
            await Promise.all([
              import("zod"),
              import("@/server/auth/session"),
              import("@/server/auth/local-user"),
              import("@/server/dc/dc-repository"),
            ]);
          const body = await request.json().catch(() => null);
          const mode = z.discriminatedUnion("action", [
            z.object({
              action: z.literal("update"),
              payload: await dcPayloadSchema(),
              currentVersionId: z.string().uuid().nullable(),
            }),
            z.object({ action: z.literal("stage"), etapa: z.enum(["em_criacao", "em_aprovacao", "concluido"]) }),
            z.object({ action: z.literal("finalize_review"), versionId: z.string().uuid() }),
          ]).parse(body);
          const user = await requireAuthenticatedUser(request);
          await requireLocalUser(user.userId);

          if (mode.action === "update") {
            return Response.json({
              ok: true,
              ...(await repo.updateDc({
                actorUserId: user.userId,
                projectId: params.projectId,
                dcId: params.dcId,
                payload: mode.payload,
                currentVersionId: mode.currentVersionId,
              })),
            });
          }
          if (mode.action === "finalize_review") {
            return Response.json({
              ok: true,
              ...(await repo.finalizeDcReview({
                actorUserId: user.userId,
                projectId: params.projectId,
                dcId: params.dcId,
                versionId: mode.versionId,
              })),
            });
          }
          await repo.updateDcStage({
            actorUserId: user.userId,
            projectId: params.projectId,
            dcId: params.dcId,
            etapa: mode.etapa,
          });
          return Response.json({ ok: true });
        } catch (error) {
          const { toErrorResponse } = await import("@/server/http/errors");
          return toErrorResponse(error);
        }
      },
      DELETE: async ({ request, params }) => {
        try {
          const [{ requireAuthenticatedUser }, { requireLocalUser }, { deleteDc }] =
            await Promise.all([
              import("@/server/auth/session"),
              import("@/server/auth/local-user"),
              import("@/server/dc/dc-repository"),
            ]);
          const user = await requireAuthenticatedUser(request);
          await requireLocalUser(user.userId);
          await deleteDc({ actorUserId: user.userId, projectId: params.projectId, dcId: params.dcId });
          return Response.json({ ok: true });
        } catch (error) {
          const { toErrorResponse } = await import("@/server/http/errors");
          return toErrorResponse(error);
        }
      },
    },
  },
});
