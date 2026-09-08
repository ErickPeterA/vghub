import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/performance-configs")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const [{ requireAuthenticatedUser }, { requireLocalUser }, repo] = await Promise.all([
            import("@/server/auth/supabase-bearer"),
            import("@/server/auth/local-user"),
            import("@/server/performance/performance-repository"),
          ]);
          const user = await requireAuthenticatedUser(request);
          await requireLocalUser(user.userId);
          const rawProjectId = new URL(request.url).searchParams.get("projectId");
          const projectId = rawProjectId || null;
          return Response.json({
            ok: true,
            configs: await repo.listPerformanceConfigs(user.userId, projectId),
          });
        } catch (error) {
          const { toErrorResponse } = await import("@/server/http/errors");
          return toErrorResponse(error);
        }
      },
      POST: async ({ request }) => {
        try {
          const [{ z }, { requireAuthenticatedUser }, { requireLocalUser }, repo] =
            await Promise.all([
              import("zod"),
              import("@/server/auth/supabase-bearer"),
              import("@/server/auth/local-user"),
              import("@/server/performance/performance-repository"),
            ]);
          const jsonValue = z.union([
            z.string(),
            z.number(),
            z.boolean(),
            z.null(),
            z.array(z.any()),
            z.record(z.string(), z.any()),
          ]);
          const input = z
            .object({
              projectId: z.string().uuid().nullable(),
              configs: z.array(
                z.object({
                  name: z.string().trim().min(1),
                  reviewType: z.enum(["experience", "performance"]),
                  periodDays: z.number().int().positive(),
                  questionsSchema: jsonValue,
                  isActive: z.boolean(),
                }),
              ),
            })
            .parse(await request.json().catch(() => null));
          const user = await requireAuthenticatedUser(request);
          await requireLocalUser(user.userId);
          return Response.json({
            ok: true,
            configs: await repo.createMissingPerformanceConfigs({
              actorUserId: user.userId,
              ...input,
            }),
          });
        } catch (error) {
          const { toErrorResponse } = await import("@/server/http/errors");
          return toErrorResponse(error);
        }
      },
      PATCH: async ({ request }) => {
        try {
          const [{ z }, { requireAuthenticatedUser }, { requireLocalUser }, repo] =
            await Promise.all([
              import("zod"),
              import("@/server/auth/supabase-bearer"),
              import("@/server/auth/local-user"),
              import("@/server/performance/performance-repository"),
            ]);
          const jsonValue = z.union([
            z.string(),
            z.number(),
            z.boolean(),
            z.null(),
            z.array(z.any()),
            z.record(z.string(), z.any()),
          ]);
          const input = z
            .object({
              projectId: z.string().uuid().nullable(),
              configId: z.string().uuid(),
              name: z.string().trim().min(1),
              periodDays: z.number().int().positive(),
              reviewType: z.enum(["experience", "performance"]),
              questionsSchema: jsonValue,
              isActive: z.boolean(),
            })
            .parse(await request.json().catch(() => null));
          const user = await requireAuthenticatedUser(request);
          await requireLocalUser(user.userId);
          return Response.json({
            ok: true,
            config: await repo.savePerformanceConfig({
              actorUserId: user.userId,
              ...input,
            }),
          });
        } catch (error) {
          const { toErrorResponse } = await import("@/server/http/errors");
          return toErrorResponse(error);
        }
      },
    },
  },
});
