import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/projects/$projectId/activity-links")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const [
            { requireAuthenticatedUser },
            { requireLocalUser },
            { getActivityLinksPageData },
          ] = await Promise.all([
            import("@/server/auth/supabase-bearer"),
            import("@/server/auth/local-user"),
            import("@/server/activities/activity-repository"),
          ]);
          const user = await requireAuthenticatedUser(request);
          await requireLocalUser(user.userId);
          return Response.json({
            ok: true,
            ...(await getActivityLinksPageData(user.userId, params.projectId)),
          });
        } catch (error) {
          const { toErrorResponse } = await import("@/server/http/errors");
          return toErrorResponse(error);
        }
      },
      POST: async ({ request, params }) => {
        try {
          const [{ z }, { requireAuthenticatedUser }, { requireLocalUser }, { createActivityLink }] =
            await Promise.all([
              import("zod"),
              import("@/server/auth/supabase-bearer"),
              import("@/server/auth/local-user"),
              import("@/server/activities/activity-repository"),
            ]);
          const body = await request.json().catch(() => null);
          const input = z
            .object({
              configId: z.string().uuid(),
              expiresAt: z.string().min(1),
              headerAnswers: z.record(z.string(), z.unknown()),
              label: z.string().nullable().optional(),
            })
            .parse(body);
          const user = await requireAuthenticatedUser(request);
          await requireLocalUser(user.userId);
          const link = await createActivityLink({
            actorUserId: user.userId,
            projectId: params.projectId,
            configId: input.configId,
            expiresAt: input.expiresAt,
            headerAnswers: input.headerAnswers,
            label: input.label ?? null,
          });
          return Response.json({ ok: true, link }, { status: 201 });
        } catch (error) {
          const { toErrorResponse } = await import("@/server/http/errors");
          return toErrorResponse(error);
        }
      },
      PATCH: async ({ request, params }) => {
        try {
          const [{ z }, { requireAuthenticatedUser }, { requireLocalUser }, { updateActivityLink }] =
            await Promise.all([
              import("zod"),
              import("@/server/auth/supabase-bearer"),
              import("@/server/auth/local-user"),
              import("@/server/activities/activity-repository"),
            ]);
          const body = await request.json().catch(() => null);
          const input = z
            .object({
              linkId: z.string().uuid(),
              action: z.enum(["cancel", "reactivate", "mark_reviewed"]),
              expiresAt: z.string().optional(),
            })
            .parse(body);
          const user = await requireAuthenticatedUser(request);
          await requireLocalUser(user.userId);
          const link = await updateActivityLink({
            actorUserId: user.userId,
            projectId: params.projectId,
            linkId: input.linkId,
            action: input.action,
            expiresAt: input.expiresAt,
          });
          return Response.json({ ok: true, link });
        } catch (error) {
          const { toErrorResponse } = await import("@/server/http/errors");
          return toErrorResponse(error);
        }
      },
    },
  },
});
