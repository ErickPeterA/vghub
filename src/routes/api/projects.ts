import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/projects")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const [{ requireAuthenticatedUser }, { requireLocalUser }, { listProjectsForUser }] =
            await Promise.all([
              import("@/server/auth/session"),
              import("@/server/auth/local-user"),
              import("@/server/projects/project-repository"),
            ]);
          const user = await requireAuthenticatedUser(request);
          await requireLocalUser(user.userId);
          const projects = await listProjectsForUser(user.userId);

          return Response.json({ ok: true, projects });
        } catch (error) {
          const { toErrorResponse } = await import("@/server/http/errors");
          return toErrorResponse(error);
        }
      },
      POST: async ({ request }) => {
        try {
          const [
            { z },
            { requireAuthenticatedUser },
            { requireAdminUser },
            { createProjectForAdmin },
          ] = await Promise.all([
            import("zod"),
            import("@/server/auth/session"),
            import("@/server/auth/local-user"),
            import("@/server/projects/project-repository"),
          ]);
          const body = await request.json().catch(() => null);
          const input = z
            .object({
              nome: z.string().trim().min(1).max(255),
              empresa: z.string().trim().max(255).optional().nullable(),
              responsavelId: z.string().uuid().optional().nullable().or(z.literal("")),
            })
            .parse(body);

          const user = await requireAuthenticatedUser(request);
          await requireAdminUser(user.userId);
          const project = await createProjectForAdmin({
            actorUserId: user.userId,
            nome: input.nome,
            empresa: input.empresa || null,
            responsavelId: input.responsavelId || null,
          });

          return Response.json({ ok: true, project }, { status: 201 });
        } catch (error) {
          const { toErrorResponse } = await import("@/server/http/errors");
          return toErrorResponse(error);
        }
      },
      PATCH: async ({ request }) => {
        try {
          const [
            { z },
            { requireAuthenticatedUser },
            { requireAdminUser },
            { updateProjectStatusForAdmin },
          ] = await Promise.all([
            import("zod"),
            import("@/server/auth/session"),
            import("@/server/auth/local-user"),
            import("@/server/projects/project-repository"),
          ]);
          const body = await request.json().catch(() => null);
          const input = z
            .object({
              id: z.string().uuid(),
              status: z.enum(["ativo", "desativado"]),
            })
            .parse(body);

          const user = await requireAuthenticatedUser(request);
          await requireAdminUser(user.userId);
          const project = await updateProjectStatusForAdmin({
            actorUserId: user.userId,
            projectId: input.id,
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
