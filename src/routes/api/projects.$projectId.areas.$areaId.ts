import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/projects/$projectId/areas/$areaId")({
  server: {
    handlers: {
      PATCH: async ({ params, request }) => {
        try {
          const [{ z }, { requireAuthenticatedUser }, { requireLocalUser }, { updateProjectArea }] =
            await Promise.all([
              import("zod"),
              import("@/server/auth/supabase-bearer"),
              import("@/server/auth/local-user"),
              import("@/server/areas/area-repository"),
            ]);
          const body = await request.json().catch(() => null);
          const input = z
            .object({
              nome: z.string().trim().min(1).optional(),
              cor: z.string().trim().optional().nullable(),
              displayOrder: z.number().int().optional(),
            })
            .parse(body);

          const user = await requireAuthenticatedUser(request);
          await requireLocalUser(user.userId);
          const area = await updateProjectArea({
            actorUserId: user.userId,
            projectId: params.projectId,
            areaId: params.areaId,
            nome: input.nome,
            cor: input.cor,
            displayOrder: input.displayOrder,
          });

          if (!area) {
            return Response.json(
              { error: "not_found", message: "Area nao encontrada." },
              { status: 404 },
            );
          }

          return Response.json({ ok: true, area });
        } catch (error) {
          const { toErrorResponse } = await import("@/server/http/errors");
          return toErrorResponse(error);
        }
      },
      DELETE: async ({ params, request }) => {
        try {
          const [{ requireAuthenticatedUser }, { requireLocalUser }, { deleteProjectArea }] =
            await Promise.all([
              import("@/server/auth/supabase-bearer"),
              import("@/server/auth/local-user"),
              import("@/server/areas/area-repository"),
            ]);
          const user = await requireAuthenticatedUser(request);
          await requireLocalUser(user.userId);
          const deleted = await deleteProjectArea({
            actorUserId: user.userId,
            projectId: params.projectId,
            areaId: params.areaId,
          });

          if (!deleted) {
            return Response.json(
              { error: "not_found", message: "Area nao encontrada." },
              { status: 404 },
            );
          }

          return Response.json({ ok: true });
        } catch (error) {
          const { toErrorResponse } = await import("@/server/http/errors");
          return toErrorResponse(error);
        }
      },
    },
  },
});
