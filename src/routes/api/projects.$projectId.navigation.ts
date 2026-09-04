import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/projects/$projectId/navigation")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const [{ requireAuthenticatedUser }, { requireLocalUser }, { getProjectNavigationData }] =
            await Promise.all([
              import("@/server/auth/supabase-bearer"),
              import("@/server/auth/local-user"),
              import("@/server/navigation/navigation-repository"),
            ]);
          const user = await requireAuthenticatedUser(request);
          await requireLocalUser(user.userId);
          return Response.json({
            ok: true,
            ...(await getProjectNavigationData(user.userId, params.projectId)),
          });
        } catch (error) {
          const { toErrorResponse } = await import("@/server/http/errors");
          return toErrorResponse(error);
        }
      },
    },
  },
});
