import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/projects/$projectId/areas")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        try {
          const [{ requireAuthenticatedUser }, { requireLocalUser }, { listProjectAreas }] =
            await Promise.all([
              import("@/server/auth/supabase-bearer"),
              import("@/server/auth/local-user"),
              import("@/server/areas/area-repository"),
            ]);
          const user = await requireAuthenticatedUser(request);
          await requireLocalUser(user.userId);
          const areas = await listProjectAreas(user.userId, params.projectId);

          return Response.json({ ok: true, areas });
        } catch (error) {
          const { toErrorResponse } = await import("@/server/http/errors");
          return toErrorResponse(error);
        }
      },
      POST: async ({ params, request }) => {
        try {
          const [{ z }, { requireAuthenticatedUser }, { requireLocalUser }, { createProjectArea }] =
            await Promise.all([
              import("zod"),
              import("@/server/auth/supabase-bearer"),
              import("@/server/auth/local-user"),
              import("@/server/areas/area-repository"),
            ]);
          const body = await request.json().catch(() => null);
          const input = z
            .object({
              parentId: z.string().uuid().optional().nullable(),
              nome: z.string().trim().min(1),
              cor: z.string().trim().optional().nullable(),
              displayOrder: z.number().int().optional(),
            })
            .parse(body);

          const user = await requireAuthenticatedUser(request);
          await requireLocalUser(user.userId);
          const area = await createProjectArea({
            actorUserId: user.userId,
            projectId: params.projectId,
            parentId: input.parentId ?? null,
            nome: input.nome,
            cor: input.cor ?? null,
            displayOrder: input.displayOrder,
          });

          return Response.json({ ok: true, area }, { status: 201 });
        } catch (error) {
          const { toErrorResponse } = await import("@/server/http/errors");
          return toErrorResponse(error);
        }
      },
    },
  },
});
