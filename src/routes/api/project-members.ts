import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/project-members")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const [{ requireAuthenticatedUser }, { requireAdminUser }, { getProjectAccessPageData }] =
            await Promise.all([
            import("@/server/auth/session"),
              import("@/server/auth/local-user"),
              import("@/server/project-access/project-access-repository"),
            ]);
          const user = await requireAuthenticatedUser(request);
          await requireAdminUser(user.userId);
          const data = await getProjectAccessPageData();
          return Response.json({
            ok: true,
            members: data.members,
            users: data.profiles,
            projects: data.areasOrProjects,
          });
        } catch (error) {
          const { toErrorResponse } = await import("@/server/http/errors");
          return toErrorResponse(error);
        }
      },
    },
  },
});
