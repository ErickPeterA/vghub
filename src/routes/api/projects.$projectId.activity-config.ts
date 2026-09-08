import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/projects/$projectId/activity-config")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const [{ requireAuthenticatedUser }, { requireLocalUser }, { getActivityConfig }] =
            await Promise.all([
            import("@/server/auth/session"),
              import("@/server/auth/local-user"),
              import("@/server/activities/activity-repository"),
            ]);
          const user = await requireAuthenticatedUser(request);
          await requireLocalUser(user.userId);
          const config = await getActivityConfig(user.userId, params.projectId);
          return Response.json({ ok: true, config });
        } catch (error) {
          const { toErrorResponse } = await import("@/server/http/errors");
          return toErrorResponse(error);
        }
      },
      POST: async ({ request, params }) => {
        try {
          const [{ z }, { requireAuthenticatedUser }, { requireLocalUser }, { upsertActivityConfig }] =
            await Promise.all([
              import("zod"),
              import("@/server/auth/session"),
              import("@/server/auth/local-user"),
              import("@/server/activities/activity-repository"),
            ]);
          const body = await request.json().catch(() => null);
          const input = z
            .object({
              headerSchema: z.unknown(),
              questionsSchema: z.unknown(),
              isActive: z.boolean(),
            })
            .parse(body);
          const user = await requireAuthenticatedUser(request);
          await requireLocalUser(user.userId);
          const config = await upsertActivityConfig({
            actorUserId: user.userId,
            projectId: params.projectId,
            headerSchema: input.headerSchema,
            questionsSchema: input.questionsSchema,
            isActive: input.isActive,
          });
          return Response.json({ ok: true, config });
        } catch (error) {
          const { toErrorResponse } = await import("@/server/http/errors");
          return toErrorResponse(error);
        }
      },
    },
  },
});
