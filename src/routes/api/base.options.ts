import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/base/options")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const [{ z }, { requireAuthenticatedUser }, { requireLocalUser }, { createBaseOption }] =
            await Promise.all([
              import("zod"),
            import("@/server/auth/session"),
              import("@/server/auth/local-user"),
              import("@/server/base/base-repository"),
            ]);
          const body = await request.json().catch(() => null);
          const input = z
            .object({
              fieldId: z.string().uuid(),
              label: z.string().trim().min(1),
              value: z.string().trim().min(1),
              description: z.string().nullable().optional(),
              display_order: z.number().int().optional(),
              is_active: z.boolean().optional(),
            })
            .parse(body);

          const user = await requireAuthenticatedUser(request);
          await requireLocalUser(user.userId);
          const option = await createBaseOption({
            actorUserId: user.userId,
            fieldId: input.fieldId,
            label: input.label,
            value: input.value,
            description: input.description,
            display_order: input.display_order,
            is_active: input.is_active,
          });

          if (!option) {
            return Response.json(
              { error: "not_found", message: "Campo nao encontrado." },
              { status: 404 },
            );
          }

          return Response.json({ ok: true, option }, { status: 201 });
        } catch (error) {
          const { toErrorResponse } = await import("@/server/http/errors");
          return toErrorResponse(error);
        }
      },
    },
  },
});
