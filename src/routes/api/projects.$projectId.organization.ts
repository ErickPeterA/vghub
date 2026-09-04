import { createFileRoute } from "@tanstack/react-router";

const positionSchema = async () => {
  const { z } = await import("zod");
  return z.object({
    nome: z.string().trim().min(1),
    descricao: z.string().nullable().optional(),
    parent_id: z.string().uuid().nullable().optional(),
    display_order: z.number().int(),
    status: z.enum(["active", "inactive"]),
  });
};

export const Route = createFileRoute("/api/projects/$projectId/organization")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const [{ requireAuthenticatedUser }, { requireLocalUser }, { getOrganizationPageData }] =
            await Promise.all([
              import("@/server/auth/supabase-bearer"),
              import("@/server/auth/local-user"),
              import("@/server/organization/organization-repository"),
            ]);
          const user = await requireAuthenticatedUser(request);
          await requireLocalUser(user.userId);
          return Response.json({
            ok: true,
            ...(await getOrganizationPageData(user.userId, params.projectId)),
          });
        } catch (error) {
          const { toErrorResponse } = await import("@/server/http/errors");
          return toErrorResponse(error);
        }
      },
      POST: async ({ request, params }) => {
        try {
          const [
            { z },
            { requireAuthenticatedUser },
            { requireLocalUser },
            organization,
          ] = await Promise.all([
            import("zod"),
            import("@/server/auth/supabase-bearer"),
            import("@/server/auth/local-user"),
            import("@/server/organization/organization-repository"),
          ]);
          const body = await request.json().catch(() => null);
          const schema = await positionSchema();
          const input = z
            .discriminatedUnion("action", [
              z.object({ action: z.literal("create"), values: schema }),
              z.object({
                action: z.literal("update"),
                positionId: z.string().uuid(),
                values: schema,
              }),
              z.object({
                action: z.literal("shift"),
                updates: z.array(
                  z.object({
                    id: z.string().uuid(),
                    parentId: z.string().uuid().nullable().optional(),
                    displayOrder: z.number().int(),
                  }),
                ),
              }),
              z.object({
                action: z.literal("insertAbove"),
                targetId: z.string().uuid(),
                values: schema.pick({ nome: true, descricao: true, status: true }),
              }),
              z.object({
                action: z.literal("move"),
                positionId: z.string().uuid(),
                parentId: z.string().uuid().nullable(),
              }),
              z.object({
                action: z.literal("delete"),
                positionId: z.string().uuid(),
                childrenParentId: z.string().uuid().nullable(),
              }),
              z.object({
                action: z.literal("reorder"),
                positionId: z.string().uuid(),
                direction: z.enum(["up", "down"]),
              }),
            ])
            .parse(body);
          const user = await requireAuthenticatedUser(request);
          await requireLocalUser(user.userId);

          if (input.action === "create") {
            return Response.json({
              ok: true,
              position: await organization.createPosition(user.userId, params.projectId, input.values),
            });
          }
          if (input.action === "update") {
            return Response.json({
              ok: true,
              position: await organization.updatePosition(
                user.userId,
                params.projectId,
                input.positionId,
                input.values,
              ),
            });
          }
          if (input.action === "shift") {
            return Response.json({
              ok: true,
              result: await organization.shiftPositionOrders(user.userId, params.projectId, input.updates),
            });
          }
          if (input.action === "insertAbove") {
            return Response.json({
              ok: true,
              position: await organization.insertPositionAbove(user.userId, input.targetId, input.values),
            });
          }
          if (input.action === "move") {
            return Response.json({
              ok: true,
              result: await organization.movePosition(user.userId, input.positionId, input.parentId),
            });
          }
          if (input.action === "delete") {
            return Response.json({
              ok: true,
              result: await organization.deletePosition(
                user.userId,
                input.positionId,
                input.childrenParentId,
              ),
            });
          }
          return Response.json({
            ok: true,
            result: await organization.reorderPosition(user.userId, input.positionId, input.direction),
          });
        } catch (error) {
          const { toErrorResponse } = await import("@/server/http/errors");
          return toErrorResponse(error);
        }
      },
    },
  },
});
