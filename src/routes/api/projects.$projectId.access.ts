import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/projects/$projectId/access")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const [{ requireAuthenticatedUser }, { requireAdminUser }, { getProjectAccessPageData }] =
            await Promise.all([
            import("@/server/auth/session"),
              import("@/server/auth/local-user"),
              import("@/server/project-access/project-access-repository"),
            ]);
          const user = await requireAuthenticatedUser(request);
          await requireAdminUser(user.userId);
          const data = await getProjectAccessPageData(params.projectId);
          return Response.json({
            ok: true,
            members: data.members,
            profiles: data.profiles,
            areas: data.areasOrProjects,
            scopes: data.scopes,
          });
        } catch (error) {
          const { toErrorResponse } = await import("@/server/http/errors");
          return toErrorResponse(error);
        }
      },
      POST: async ({ request }) => {
        try {
          const [{ z }, { requireAuthenticatedUser }, { requireAdminUser }, { addProjectMemberScope }] =
            await Promise.all([
              import("zod"),
              import("@/server/auth/session"),
              import("@/server/auth/local-user"),
              import("@/server/project-access/project-access-repository"),
            ]);
          const input = z
            .object({ memberId: z.string().uuid(), areaId: z.string().uuid() })
            .parse(await request.json().catch(() => null));
          const user = await requireAuthenticatedUser(request);
          await requireAdminUser(user.userId);
          return Response.json({ ok: true, scope: await addProjectMemberScope(input.memberId, input.areaId) });
        } catch (error) {
          const { toErrorResponse } = await import("@/server/http/errors");
          return toErrorResponse(error);
        }
      },
      DELETE: async ({ request }) => {
        try {
          const [{ z }, { requireAuthenticatedUser }, { requireAdminUser }, { removeProjectMemberScope }] =
            await Promise.all([
              import("zod"),
              import("@/server/auth/session"),
              import("@/server/auth/local-user"),
              import("@/server/project-access/project-access-repository"),
            ]);
          const url = new URL(request.url);
          const input = z.object({ scopeId: z.string().uuid() }).parse({
            scopeId: url.searchParams.get("scopeId"),
          });
          const user = await requireAuthenticatedUser(request);
          await requireAdminUser(user.userId);
          await removeProjectMemberScope(input.scopeId);
          return Response.json({ ok: true });
        } catch (error) {
          const { toErrorResponse } = await import("@/server/http/errors");
          return toErrorResponse(error);
        }
      },
    },
  },
});
