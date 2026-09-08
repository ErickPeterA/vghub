import { createFileRoute } from "@tanstack/react-router";

type Body = {
  itemId?: string;
  problem_reason?: string;
  improvement_plan?: string;
  evidence_plan?: string;
  review_date?: string | null;
  status?: "not_started" | "in_progress" | "completed";
};

function filled(body: Body) {
  return Boolean(
    body.problem_reason?.trim() && body.improvement_plan?.trim() && body.evidence_plan?.trim(),
  );
}

export const Route = createFileRoute("/api/public/pam-draft/$token")({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
        let body: Body;
        try {
          body = await request.json();
        } catch {
          return Response.json(
            { error: "invalid_body", message: "Payload invalido." },
            { status: 400 },
          );
        }
        if (!body.itemId) {
          return Response.json(
            { error: "missing_item", message: "Item nao informado." },
            { status: 400 },
          );
        }

        const nextStatus = body.status ?? (filled(body) ? "in_progress" : "not_started");
        if (nextStatus === "completed" && !filled(body)) {
          return Response.json(
            { error: "incomplete_item", message: "Preencha todos os campos antes de concluir." },
            { status: 400 },
          );
        }

        try {
          const { savePublicPamDraft } = await import("@/server/pam/pam-repository");
          const result = await savePublicPamDraft({
            token: params.token,
            itemId: body.itemId,
            problemReason: body.problem_reason ?? "",
            improvementPlan: body.improvement_plan ?? "",
            evidencePlan: body.evidence_plan ?? "",
            reviewDate: body.review_date || null,
            status: nextStatus,
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
