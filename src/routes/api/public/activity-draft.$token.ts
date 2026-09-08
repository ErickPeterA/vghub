import { createFileRoute } from "@tanstack/react-router";

type QuestionAnswers = Record<string, string> | Array<Record<string, string>>;

export const Route = createFileRoute("/api/public/activity-draft/$token")({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
        let body: { header_answers?: Record<string, string>; question_answers?: QuestionAnswers };
        try {
          body = await request.json();
        } catch {
          return Response.json(
            { error: "invalid_body", message: "Payload invalido." },
            { status: 400 },
          );
        }

        try {
          const { savePublicActivityDraft } = await import(
            "@/server/activities/activity-repository"
          );
          const result = await savePublicActivityDraft({
            token: params.token,
            headerAnswers: body.header_answers ?? {},
            questionAnswers: body.question_answers ?? [],
          });
          return Response.json({ ok: true, savedAt: result.savedAt });
        } catch (error) {
          const { toErrorResponse } = await import("@/server/http/errors");
          return toErrorResponse(error);
        }
      },
    },
  },
});
