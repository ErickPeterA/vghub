import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/dc/$dcId/comments")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const [{ requireAuthenticatedUser }, { requireLocalUser }, { getFieldComments }] =
            await Promise.all([
            import("@/server/auth/session"),
              import("@/server/auth/local-user"),
              import("@/server/dc/dc-repository"),
            ]);
          const user = await requireAuthenticatedUser(request);
          await requireLocalUser(user.userId);
          const url = new URL(request.url);
          return Response.json({
            ok: true,
            ...(await getFieldComments({
              userId: user.userId,
              dcId: params.dcId,
              fieldKey: url.searchParams.get("fieldKey") ?? "",
              versionId: url.searchParams.get("versionId"),
            })),
          });
        } catch (error) {
          const { toErrorResponse } = await import("@/server/http/errors");
          return toErrorResponse(error);
        }
      },
      POST: async ({ request, params }) => {
        try {
          const [{ z }, { requireAuthenticatedUser }, { requireLocalUser }, { addFieldComment }] =
            await Promise.all([
              import("zod"),
              import("@/server/auth/session"),
              import("@/server/auth/local-user"),
              import("@/server/dc/dc-repository"),
            ]);
          const input = z
            .object({
              fieldKey: z.string().min(1),
              versionId: z.string().uuid().nullable(),
              content: z.string().trim().min(1),
            })
            .parse(await request.json().catch(() => null));
          const user = await requireAuthenticatedUser(request);
          await requireLocalUser(user.userId);
          await addFieldComment({
            actorUserId: user.userId,
            dcId: params.dcId,
            fieldKey: input.fieldKey,
            versionId: input.versionId,
            content: input.content,
          });
          return Response.json({ ok: true }, { status: 201 });
        } catch (error) {
          const { toErrorResponse } = await import("@/server/http/errors");
          return toErrorResponse(error);
        }
      },
      PATCH: async ({ request }) => {
        try {
          const [{ z }, { requireAuthenticatedUser }, { requireLocalUser }, { decideFieldComment }] =
            await Promise.all([
              import("zod"),
              import("@/server/auth/session"),
              import("@/server/auth/local-user"),
              import("@/server/dc/dc-repository"),
            ]);
          const input = z
            .object({
              commentId: z.string().uuid(),
              decision: z.enum(["approved", "rejected"]),
            })
            .parse(await request.json().catch(() => null));
          const user = await requireAuthenticatedUser(request);
          await requireLocalUser(user.userId);
          await decideFieldComment({
            actorUserId: user.userId,
            commentId: input.commentId,
            decision: input.decision,
          });
          return Response.json({ ok: true });
        } catch (error) {
          const { toErrorResponse } = await import("@/server/http/errors");
          return toErrorResponse(error);
        }
      },
    },
  },
});
