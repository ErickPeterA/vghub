import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/projects/$projectId/pam")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const [{ requireAuthenticatedUser }, { requireLocalUser }, { getPamPageData }] =
            await Promise.all([
              import("@/server/auth/supabase-bearer"),
              import("@/server/auth/local-user"),
              import("@/server/pam/pam-repository"),
            ]);
          const user = await requireAuthenticatedUser(request);
          await requireLocalUser(user.userId);
          return Response.json({ ok: true, ...(await getPamPageData(user.userId, params.projectId)) });
        } catch (error) {
          const { toErrorResponse } = await import("@/server/http/errors");
          return toErrorResponse(error);
        }
      },
      POST: async ({ request, params }) => {
        try {
          const [{ z }, { requireAuthenticatedUser }, { requireLocalUser }, repo] =
            await Promise.all([
              import("zod"),
              import("@/server/auth/supabase-bearer"),
              import("@/server/auth/local-user"),
              import("@/server/pam/pam-repository"),
            ]);
          const body = await request.json().catch(() => null);
          const mode = z.discriminatedUnion("action", [
            z.object({
              action: z.literal("create_pam"),
              reviewId: z.string().uuid(),
              employeeId: z.string().uuid().nullable(),
              employeeName: z.string().min(1),
              jobTitle: z.string().nullable(),
              feedbackDate: z.string().nullable(),
              items: z.array(
                z.object({
                  source: z.string(),
                  source_key: z.string().nullable(),
                  source_score: z.number().nullable(),
                  improvement_point: z.string().min(1),
                  skill_label: z.string().nullable(),
                  display_order: z.number().int(),
                }),
              ),
            }),
            z.object({
              action: z.literal("add_item"),
              pamId: z.string().uuid(),
              source: z.string(),
              improvementPoint: z.string().min(1),
              skillLabel: z.string().nullable(),
              displayOrder: z.number().int(),
            }),
          ]).parse(body);
          const user = await requireAuthenticatedUser(request);
          await requireLocalUser(user.userId);

          if (mode.action === "create_pam") {
            const pam = await repo.createPam({
              actorUserId: user.userId,
              projectId: params.projectId,
              reviewId: mode.reviewId,
              employeeId: mode.employeeId,
              employeeName: mode.employeeName,
              jobTitle: mode.jobTitle,
              feedbackDate: mode.feedbackDate,
              items: mode.items,
            });
            return Response.json({ ok: true, pam }, { status: 201 });
          }

          const item = await repo.addPamItem({
            actorUserId: user.userId,
            projectId: params.projectId,
            pamId: mode.pamId,
            source: mode.source,
            improvementPoint: mode.improvementPoint,
            skillLabel: mode.skillLabel,
            displayOrder: mode.displayOrder,
          });
          return Response.json({ ok: true, item }, { status: 201 });
        } catch (error) {
          const { toErrorResponse } = await import("@/server/http/errors");
          return toErrorResponse(error);
        }
      },
      PATCH: async ({ request, params }) => {
        try {
          const [{ z }, { requireAuthenticatedUser }, { requireLocalUser }, { updatePam }] =
            await Promise.all([
              import("zod"),
              import("@/server/auth/supabase-bearer"),
              import("@/server/auth/local-user"),
              import("@/server/pam/pam-repository"),
            ]);
          const body = await request.json().catch(() => null);
          const input = z
            .object({
              pamId: z.string().uuid(),
              patch: z.object({
                status: z.enum(["draft", "released", "in_progress", "completed"]).optional(),
                released_at: z.string().nullable().optional(),
                completed_at: z.string().nullable().optional(),
                link_revoked_at: z.string().nullable().optional(),
              }),
            })
            .parse(body);
          const user = await requireAuthenticatedUser(request);
          await requireLocalUser(user.userId);
          const pam = await updatePam({
            actorUserId: user.userId,
            projectId: params.projectId,
            pamId: input.pamId,
            patch: input.patch,
          });
          return Response.json({ ok: true, pam });
        } catch (error) {
          const { toErrorResponse } = await import("@/server/http/errors");
          return toErrorResponse(error);
        }
      },
      DELETE: async ({ request, params }) => {
        try {
          const [{ requireAuthenticatedUser }, { requireLocalUser }, { deletePamItem }] =
            await Promise.all([
              import("@/server/auth/supabase-bearer"),
              import("@/server/auth/local-user"),
              import("@/server/pam/pam-repository"),
            ]);
          const url = new URL(request.url);
          const itemId = url.searchParams.get("itemId");
          if (!itemId) {
            return Response.json({ error: "invalid_body", message: "Item nao informado." }, { status: 400 });
          }
          const user = await requireAuthenticatedUser(request);
          await requireLocalUser(user.userId);
          await deletePamItem({ actorUserId: user.userId, projectId: params.projectId, itemId });
          return Response.json({ ok: true });
        } catch (error) {
          const { toErrorResponse } = await import("@/server/http/errors");
          return toErrorResponse(error);
        }
      },
    },
  },
});
