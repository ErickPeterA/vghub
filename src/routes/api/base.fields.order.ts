import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/base/fields/order")({
  server: {
    handlers: {
      PATCH: async ({ request }) => {
        try {
          const [
            { z },
            { requireAuthenticatedUser },
            { requireLocalUser },
            { updateBaseFieldOrder },
          ] = await Promise.all([
            import("zod"),
            import("@/server/auth/session"),
            import("@/server/auth/local-user"),
            import("@/server/base/base-repository"),
          ]);
          const body = await request.json().catch(() => null);
          const input = z
            .object({
              updates: z
                .array(
                  z.object({
                    id: z.string().uuid(),
                    section: z.string().trim().min(1),
                    display_order: z.number().int(),
                  }),
                )
                .max(300),
            })
            .parse(body);

          const user = await requireAuthenticatedUser(request);
          await requireLocalUser(user.userId);
          await updateBaseFieldOrder(user.userId, input.updates);

          return Response.json({ ok: true });
        } catch (error) {
          const { toErrorResponse } = await import("@/server/http/errors");
          return toErrorResponse(error);
        }
      },
    },
  },
});
