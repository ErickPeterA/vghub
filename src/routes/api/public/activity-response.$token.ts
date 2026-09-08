import { createFileRoute } from "@tanstack/react-router";

type QuestionAnswers = Record<string, string> | Array<Record<string, string>>;

export const Route = createFileRoute("/api/public/activity-response/$token")({
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
          const { submitPublicActivityResponse } = await import(
            "@/server/activities/activity-repository"
          );
          await submitPublicActivityResponse({
            token: params.token,
            headerAnswers: body.header_answers ?? {},
            questionAnswers: body.question_answers ?? [],
            submittedIp: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
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
