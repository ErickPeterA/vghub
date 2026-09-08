import { createFileRoute } from "@tanstack/react-router";

const fieldTypeValues = [
  "text",
  "textarea",
  "number",
  "date",
  "checkbox",
  "single_select",
  "multi_select",
  "competency_description",
] as const;

const dataSourceValues = ["manual", "areas", "setores"] as const;

export const Route = createFileRoute("/api/base/fields")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const [{ z }, { requireAuthenticatedUser }, { requireLocalUser }, { createBaseField }] =
            await Promise.all([
              import("zod"),
            import("@/server/auth/session"),
              import("@/server/auth/local-user"),
              import("@/server/base/base-repository"),
            ]);
          const body = await request.json().catch(() => null);
          const input = z
            .object({
              projectId: z.string().uuid().optional().nullable(),
              field: z.object({
                field_key: z.string().trim().min(1),
                label: z.string().trim().min(1),
                section: z.string().trim().min(1),
                field_type: z.enum(fieldTypeValues).optional(),
                is_required: z.boolean().optional(),
                display_order: z.number().int().optional(),
                allows_multiple: z.boolean().optional(),
                allows_free_text: z.boolean().optional(),
                is_active: z.boolean().optional(),
                data_source: z.enum(dataSourceValues).optional(),
              }),
              options: z
                .array(
                  z.object({
                    label: z.string().trim().min(1),
                    value: z.string().trim().min(1),
                    description: z.string().nullable().optional(),
                    display_order: z.number().int().optional(),
                    is_active: z.boolean().optional(),
                  }),
                )
                .optional(),
            })
            .parse(body);

          const user = await requireAuthenticatedUser(request);
          await requireLocalUser(user.userId);
          const field = await createBaseField({
            actorUserId: user.userId,
            projectId: input.projectId ?? null,
            field: input.field,
            options: input.options,
          });

          return Response.json({ ok: true, field }, { status: 201 });
        } catch (error) {
          const { toErrorResponse } = await import("@/server/http/errors");
          return toErrorResponse(error);
        }
      },
    },
  },
});
