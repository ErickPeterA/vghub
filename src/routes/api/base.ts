import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/base")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const [{ z }, { requireAuthenticatedUser }, { requireLocalUser }, { listBaseConfig }] =
            await Promise.all([
              import("zod"),
            import("@/server/auth/session"),
              import("@/server/auth/local-user"),
              import("@/server/base/base-repository"),
            ]);
          const url = new URL(request.url);
          const input = z
            .object({
              projectId: z.string().uuid().optional().nullable(),
            })
            .parse({ projectId: url.searchParams.get("projectId") });
          const user = await requireAuthenticatedUser(request);
          await requireLocalUser(user.userId);
          const config = await listBaseConfig(user.userId, input.projectId ?? null);

          return Response.json({ ok: true, ...config });
        } catch (error) {
          const { toErrorResponse } = await import("@/server/http/errors");
          return toErrorResponse(error);
        }
      },
    },
  },
});
