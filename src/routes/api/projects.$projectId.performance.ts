import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/projects/$projectId/performance")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const [{ requireAuthenticatedUser }, { requireLocalUser }, repo] = await Promise.all([
            import("@/server/auth/session"),
            import("@/server/auth/local-user"),
            import("@/server/performance/performance-repository"),
          ]);
          const user = await requireAuthenticatedUser(request);
          await requireLocalUser(user.userId);
          const url = new URL(request.url);
          const view = url.searchParams.get("view") ?? "workspace";

          if (view === "access") {
            return Response.json({
              ok: true,
              canManage: await repo.canUsePerformanceManager(user.userId, params.projectId),
            });
          }
          if (view === "scoring") {
            return Response.json({
              ok: true,
              ...(await repo.getPerformanceScoringData(user.userId, params.projectId)),
            });
          }
          if (view === "comparison") {
            const reviewId = url.searchParams.get("reviewId");
            if (!reviewId) {
              return Response.json(
                { error: "invalid_query", message: "Avaliacao nao informada." },
                { status: 400 },
              );
            }
            return Response.json({
              ok: true,
              ...(await repo.getPerformanceComparisonData(
                user.userId,
                params.projectId,
                reviewId,
              )),
            });
          }
          return Response.json({
            ok: true,
            ...(await repo.getPerformanceWorkspaceData(user.userId, params.projectId)),
          });
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
              import("@/server/auth/session"),
              import("@/server/auth/local-user"),
              import("@/server/performance/performance-repository"),
            ]);
          const jsonValue = z.union([
            z.string(),
            z.number(),
            z.boolean(),
            z.null(),
            z.array(z.any()),
            z.record(z.string(), z.any()),
          ]);
          const input = z
            .discriminatedUnion("action", [
              z.object({
                action: z.literal("createReview"),
                configId: z.string().uuid(),
                employeeId: z.string().uuid(),
                leaderEmployeeId: z.string().uuid(),
                jobDescriptionId: z.string().uuid(),
                name: z.string().trim().min(1),
                periodName: z.string().trim().min(1),
                periodDays: z.number().int().positive(),
                dueDate: z.string().nullable(),
                reviewType: z.enum(["experience", "performance"]),
                jobDescriptionSnapshot: jsonValue,
                activitiesSnapshot: jsonValue,
                questionsSnapshot: jsonValue,
                evaluationWeightsSnapshot: jsonValue,
                criterionScoringSnapshot: jsonValue,
                expiresAt: z.string().datetime(),
              }),
              z.object({
                action: z.literal("addComment"),
                reviewId: z.string().uuid(),
                questionKey: z.string().trim().min(1),
                content: z.string().trim().min(1),
              }),
              z.object({
                action: z.literal("updateAnswer"),
                reviewId: z.string().uuid(),
                participantId: z.string().uuid(),
                questionKey: z.string().min(1),
                nextAnswer: z.string(),
              }),
              z.object({
                action: z.literal("finalize"),
                reviewId: z.string().uuid(),
                managementOpinion: z.string().optional(),
                scoreSummary: z.unknown().optional(),
                evaluationWeights: z.unknown().optional(),
                criterionScoring: z.unknown().optional(),
              }),
              z.object({ action: z.literal("reopen"), reviewId: z.string().uuid() }),
              z.object({
                action: z.literal("markSent"),
                participantId: z.string().uuid().optional(),
                reviewId: z.string().uuid().optional(),
              }),
              z.object({
                action: z.literal("saveWeights"),
                rows: z.array(
                  z.object({
                    careerKey: z.string().trim().min(1),
                    careerLabel: z.string().trim().min(1),
                    weights: z.record(z.string(), z.number()),
                  }),
                ),
              }),
              z.object({
                action: z.literal("saveScoring"),
                criterionKey: z.string().trim().min(1),
                scoringSchema: z.array(
                  z.object({
                    id: z.string(),
                    label: z.string(),
                    score: z.number().nullable(),
                    notApplicable: z.boolean(),
                  }),
                ),
              }),
            ])
            .parse(await request.json().catch(() => null));
          const user = await requireAuthenticatedUser(request);
          await requireLocalUser(user.userId);

          if (input.action === "createReview") {
            const { action: _action, ...reviewInput } = input;
            return Response.json(
              {
                ok: true,
                review: await repo.createPerformanceReview({
                  actorUserId: user.userId,
                  projectId: params.projectId,
                  input: reviewInput,
                }),
              },
              { status: 201 },
            );
          }
          if (input.action === "addComment") {
            return Response.json({
              ok: true,
              comment: await repo.addPerformanceComment({
                actorUserId: user.userId,
                projectId: params.projectId,
                ...input,
              }),
            });
          }
          if (input.action === "updateAnswer") {
            await repo.updatePerformanceAnswer({
              actorUserId: user.userId,
              projectId: params.projectId,
              ...input,
            });
          } else if (input.action === "finalize") {
            await repo.finalizePerformanceReview({
              actorUserId: user.userId,
              projectId: params.projectId,
              ...input,
            });
          } else if (input.action === "reopen") {
            await repo.reopenPerformanceReview({
              actorUserId: user.userId,
              projectId: params.projectId,
              reviewId: input.reviewId,
            });
          } else if (input.action === "markSent") {
            if (!input.participantId && !input.reviewId) {
              return Response.json(
                { error: "invalid_body", message: "Participante ou avaliacao nao informado." },
                { status: 400 },
              );
            }
            await repo.markPerformanceLinksSent({
              actorUserId: user.userId,
              projectId: params.projectId,
              participantId: input.participantId,
              reviewId: input.reviewId,
            });
          } else if (input.action === "saveWeights") {
            await repo.saveEvaluationWeights({
              actorUserId: user.userId,
              projectId: params.projectId,
              rows: input.rows,
            });
          } else if (input.action === "saveScoring") {
            await repo.saveCriterionScoring({
              actorUserId: user.userId,
              projectId: params.projectId,
              criterionKey: input.criterionKey,
              scoringSchema: input.scoringSchema,
            });
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
