import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/projects/$projectId")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        try {
          const [{ requireAuthenticatedUser }, { requireLocalUser }, { getProjectForUser }] =
            await Promise.all([
              import("@/server/auth/supabase-bearer"),
              import("@/server/auth/local-user"),
              import("@/server/projects/project-repository"),
            ]);
          const user = await requireAuthenticatedUser(request);
          await requireLocalUser(user.userId);
          const project = await getProjectForUser(user.userId, params.projectId);

          if (!project) {
            return Response.json(
              { error: "not_found", message: "Projeto nao encontrado." },
              { status: 404 },
            );
          }

          return Response.json({ ok: true, project });
        } catch (error) {
          const { toErrorResponse } = await import("@/server/http/errors");
          return toErrorResponse(error);
        }
      },
      PATCH: async ({ params, request }) => {
        try {
          const [
            { z },
            { requireAuthenticatedUser },
            { requireAdminUser },
            { updateProjectStatusForAdmin },
          ] = await Promise.all([
            import("zod"),
            import("@/server/auth/supabase-bearer"),
            import("@/server/auth/local-user"),
            import("@/server/projects/project-repository"),
          ]);
          const body = await request.json().catch(() => null);
          const input = z
            .object({
              status: z.enum(["ativo", "desativado"]),
            })
            .parse(body);

          const user = await requireAuthenticatedUser(request);
          await requireAdminUser(user.userId);
          const project = await updateProjectStatusForAdmin({
            actorUserId: user.userId,
            projectId: params.projectId,
            status: input.status,
          });

          if (!project) {
            return Response.json(
              { error: "not_found", message: "Projeto nao encontrado." },
              { status: 404 },
            );
          }

          return Response.json({ ok: true, project });
        } catch (error) {
          const { toErrorResponse } = await import("@/server/http/errors");
          return toErrorResponse(error);
        }
      },
    },
  },
});
