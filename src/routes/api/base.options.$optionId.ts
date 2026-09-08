import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/base/options/$optionId")({
  server: {
    handlers: {
      PATCH: async ({ params, request }) => {
        try {
          const [{ z }, { requireAuthenticatedUser }, { requireLocalUser }, { updateBaseOption }] =
            await Promise.all([
              import("zod"),
            import("@/server/auth/session"),
              import("@/server/auth/local-user"),
              import("@/server/base/base-repository"),
            ]);
          const body = await request.json().catch(() => null);
          const patch = z
            .object({
              label: z.string().trim().min(1).optional(),
              value: z.string().trim().min(1).optional(),
              description: z.string().nullable().optional(),
              display_order: z.number().int().optional(),
              is_active: z.boolean().optional(),
            })
            .parse(body);

          const user = await requireAuthenticatedUser(request);
          await requireLocalUser(user.userId);
          const option = await updateBaseOption(user.userId, params.optionId, patch);
          if (!option) {
            return Response.json(
              { error: "not_found", message: "Opcao nao encontrada." },
              { status: 404 },
            );
          }

          return Response.json({ ok: true, option });
        } catch (error) {
          const { toErrorResponse } = await import("@/server/http/errors");
          return toErrorResponse(error);
        }
      },
      DELETE: async ({ params, request }) => {
        try {
          const [{ requireAuthenticatedUser }, { requireLocalUser }, { deleteBaseOption }] =
            await Promise.all([
              import("@/server/auth/session"),
              import("@/server/auth/local-user"),
              import("@/server/base/base-repository"),
            ]);
          const user = await requireAuthenticatedUser(request);
          await requireLocalUser(user.userId);
          const deleted = await deleteBaseOption(user.userId, params.optionId);
          if (!deleted) {
            return Response.json(
              { error: "not_found", message: "Opcao nao encontrada." },
              { status: 404 },
            );
          }

          return Response.json({ ok: true });
        } catch (error) {
          const { toErrorResponse } = await import("@/server/http/errors");
          return toErrorResponse(error);
        }
      },
    },
  },
});
