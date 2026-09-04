import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/projects/$projectId/employees")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const [{ requireAuthenticatedUser }, { requireLocalUser }, { getEmployeesPageData }] =
            await Promise.all([
              import("@/server/auth/supabase-bearer"),
              import("@/server/auth/local-user"),
              import("@/server/employees/employee-repository"),
            ]);
          const user = await requireAuthenticatedUser(request);
          await requireLocalUser(user.userId);
          return Response.json({
            ok: true,
            ...(await getEmployeesPageData(user.userId, params.projectId)),
          });
        } catch (error) {
          const { toErrorResponse } = await import("@/server/http/errors");
          return toErrorResponse(error);
        }
      },
      POST: async ({ request, params }) => {
        try {
          const [{ z }, { requireAuthenticatedUser }, { requireLocalUser }, { createEmployee }] =
            await Promise.all([
              import("zod"),
              import("@/server/auth/supabase-bearer"),
              import("@/server/auth/local-user"),
              import("@/server/employees/employee-repository"),
            ]);
          const body = await request.json().catch(() => null);
          const input = z
            .object({
              positionId: z.string().uuid(),
              areaId: z.string().uuid().optional().nullable().or(z.literal("")),
              sectorId: z.string().uuid().optional().nullable().or(z.literal("")),
              superiorImediatoId: z.string().uuid().optional().nullable().or(z.literal("")),
              nome: z.string().trim().min(1),
              admissionDate: z.string().min(1),
              lastPerformanceReviewDate: z.string().optional().nullable().or(z.literal("")),
            })
            .parse(body);
          const user = await requireAuthenticatedUser(request);
          await requireLocalUser(user.userId);
          const employee = await createEmployee({
            actorUserId: user.userId,
            projectId: params.projectId,
            positionId: input.positionId,
            areaId: input.areaId || null,
            sectorId: input.sectorId || null,
            superiorImediatoId: input.superiorImediatoId || null,
            nome: input.nome,
            admissionDate: input.admissionDate,
            lastPerformanceReviewDate: input.lastPerformanceReviewDate || null,
          });
          return Response.json({ ok: true, employee }, { status: 201 });
        } catch (error) {
          const { toErrorResponse } = await import("@/server/http/errors");
          return toErrorResponse(error);
        }
      },
    },
  },
});
