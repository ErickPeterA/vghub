import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/base/sections")({
  server: {
    handlers: {
      PUT: async ({ request }) => {
        try {
          const [
            { z },
            { requireAuthenticatedUser },
            { requireLocalUser },
            { upsertBaseSectionSetting },
          ] = await Promise.all([
            import("zod"),
            import("@/server/auth/supabase-bearer"),
            import("@/server/auth/local-user"),
            import("@/server/base/base-repository"),
          ]);
          const body = await request.json().catch(() => null);
          const input = z
            .object({
              projectId: z.string().uuid().optional().nullable(),
              section: z.string().trim().min(1),
              max_items: z.number().int().min(1),
              is_enabled: z.boolean(),
            })
            .parse(body);

          const user = await requireAuthenticatedUser(request);
          await requireLocalUser(user.userId);
          const setting = await upsertBaseSectionSetting({
            actorUserId: user.userId,
            projectId: input.projectId ?? null,
            section: input.section,
            max_items: input.max_items,
            is_enabled: input.is_enabled,
          });

          return Response.json({ ok: true, setting });
        } catch (error) {
          const { toErrorResponse } = await import("@/server/http/errors");
          return toErrorResponse(error);
        }
      },
    },
  },
});
