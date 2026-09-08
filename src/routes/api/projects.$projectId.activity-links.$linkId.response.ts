import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/projects/$projectId/activity-links/$linkId/response")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const [
            { requireAuthenticatedUser },
            { requireLocalUser },
            { getActivityResponseForLink },
          ] = await Promise.all([
            import("@/server/auth/supabase-bearer"),
            import("@/server/auth/local-user"),
            import("@/server/activities/activity-repository"),
          ]);
          const user = await requireAuthenticatedUser(request);
          await requireLocalUser(user.userId);
          return Response.json({
            ok: true,
            ...(await getActivityResponseForLink(user.userId, params.projectId, params.linkId)),
          });
        } catch (error) {
          const { toErrorResponse } = await import("@/server/http/errors");
          return toErrorResponse(error);
        }
      },
    },
  },
});
