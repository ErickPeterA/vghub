import { createFileRoute } from "@tanstack/react-router";

function itemFilled(item: {
  problem_reason?: string | null;
  improvement_plan?: string | null;
  evidence_plan?: string | null;
}) {
  return Boolean(
    item.problem_reason?.trim() && item.improvement_plan?.trim() && item.evidence_plan?.trim(),
  );
}

export const Route = createFileRoute("/api/public/pam-complete/$token")({
  server: {
    handlers: {
      POST: async ({ params }) => {
        const token = params.token;
        if (!token || token.length < 32) {
          return Response.json(
            { error: "invalid_token", message: "Link invalido." },
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
          return Response.json({ ok: true });

        const { data: items } = await supabaseAdmin
          .from("pam_items")
          .select("id,problem_reason,improvement_plan,evidence_plan")
          .eq("pam_id", pam.id);

        if (!items?.length || !items.every(itemFilled)) {
          return Response.json(
            { error: "incomplete", message: "Preencha todos os pontos antes de concluir." },
            { status: 400 },
          );
        }

        const completedAt = new Date().toISOString();
        const [{ error: itemError }, { error: pamError }] = await Promise.all([
          supabaseAdmin
            .from("pam_items")
            .update({ status: "completed" })
            .eq("pam_id", pam.id),
          supabaseAdmin
            .from("pam")
            .update({ status: "completed", completed_at: completedAt })
            .eq("id", pam.id),
        ]);

        if (itemError || pamError) {
          return Response.json(
            { error: "server_error", message: itemError?.message ?? pamError?.message },
            { status: 500 },
          );
        }

        return Response.json({ ok: true, completedAt });
      },
    },
  },
});
