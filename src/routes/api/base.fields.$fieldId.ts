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

export const Route = createFileRoute("/api/base/fields/$fieldId")({
  server: {
    handlers: {
      PATCH: async ({ params, request }) => {
        try {
          const [{ z }, { requireAuthenticatedUser }, { requireLocalUser }, { updateBaseField }] =
            await Promise.all([
              import("zod"),
            import("@/server/auth/session"),
              import("@/server/auth/local-user"),
              import("@/server/base/base-repository"),
            ]);
          const body = await request.json().catch(() => null);
          const patch = z
            .object({
              field_key: z.string().trim().min(1).optional(),
              label: z.string().trim().min(1).optional(),
              section: z.string().trim().min(1).optional(),
              field_type: z.enum(fieldTypeValues).optional(),
              is_required: z.boolean().optional(),
              display_order: z.number().int().optional(),
              allows_multiple: z.boolean().optional(),
              allows_free_text: z.boolean().optional(),
              is_active: z.boolean().optional(),
              data_source: z.enum(dataSourceValues).optional(),
            })
            .parse(body);

          const user = await requireAuthenticatedUser(request);
          await requireLocalUser(user.userId);
          const field = await updateBaseField(user.userId, params.fieldId, patch);
          if (!field) {
            return Response.json(
              { error: "not_found", message: "Campo nao encontrado." },
              { status: 404 },
            );
          }

          return Response.json({ ok: true, field });
        } catch (error) {
          const { toErrorResponse } = await import("@/server/http/errors");
          return toErrorResponse(error);
        }
      },
      DELETE: async ({ params, request }) => {
        try {
          const [{ requireAuthenticatedUser }, { requireLocalUser }, { deleteBaseField }] =
            await Promise.all([
              import("@/server/auth/session"),
              import("@/server/auth/local-user"),
              import("@/server/base/base-repository"),
            ]);
          const user = await requireAuthenticatedUser(request);
          await requireLocalUser(user.userId);
          const deleted = await deleteBaseField(user.userId, params.fieldId);
          if (!deleted) {
            return Response.json(
              { error: "not_found", message: "Campo nao encontrado." },
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
