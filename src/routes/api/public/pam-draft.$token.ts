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
        const token = params.token;
        if (!token || token.length < 32) {
          return Response.json(
            { error: "invalid_token", message: "Link invalido." },
            { status: 400 },
          );
        }

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

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: pam } = await supabaseAdmin
          .from("pam")
          .select("id,status,link_revoked_at")
          .eq("token", token)
          .maybeSingle();

        if (!pam)
          return Response.json(
            { error: "not_found", message: "Link nao encontrado." },
            { status: 404 },
          );
        if (pam.link_revoked_at)
          return Response.json({ error: "revoked", message: "Link revogado." }, { status: 410 });
        if (pam.status === "draft")
          return Response.json(
            { error: "not_released", message: "PAM nao liberado." },
            { status: 403 },
          );
        if (pam.status === "completed")
          return Response.json(
            { error: "completed", message: "PAM concluido. Edicao bloqueada." },
            { status: 410 },
          );

        const nextStatus = body.status ?? (filled(body) ? "in_progress" : "not_started");
        if (nextStatus === "completed" && !filled(body)) {
          return Response.json(
            { error: "incomplete_item", message: "Preencha todos os campos antes de concluir." },
            { status: 400 },
          );
        }

        const savedAt = new Date().toISOString();
        const { error } = await supabaseAdmin
          .from("pam_items")
          .update({
            problem_reason: body.problem_reason ?? "",
            improvement_plan: body.improvement_plan ?? "",
            evidence_plan: body.evidence_plan ?? "",
            review_date: body.review_date || null,
            status: nextStatus,
          })
          .eq("id", body.itemId)
          .eq("pam_id", pam.id);

        if (error)
          return Response.json({ error: "server_error", message: error.message }, { status: 500 });

        if (pam.status === "released") {
          await supabaseAdmin.from("pam").update({ status: "in_progress" }).eq("id", pam.id);
        }

        return Response.json({ ok: true, savedAt });
      },
    },
  },
});
