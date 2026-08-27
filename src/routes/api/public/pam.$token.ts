import { createFileRoute } from "@tanstack/react-router";

type PamStatus = "draft" | "released" | "in_progress" | "completed";

export const Route = createFileRoute("/api/public/pam/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const token = params.token;
        if (!token || token.length < 32) {
          return Response.json(
            { error: "invalid_token", message: "Link invalido." },
            { status: 400 },
          );
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: pam, error } = await supabaseAdmin
          .from("pam")
          .select("*")
          .eq("token", token)
          .maybeSingle();

        if (error)
          return Response.json(
            { error: "server_error", message: "Erro ao buscar PAM." },
            { status: 500 },
          );
        if (!pam)
          return Response.json(
            { error: "not_found", message: "Este link nao existe ou foi removido." },
            { status: 404 },
          );
        if (pam.link_revoked_at)
          return Response.json(
            { error: "revoked", message: "Este link foi revogado." },
            { status: 410 },
          );
        if (pam.status === "draft")
          return Response.json(
            { error: "not_released", message: "Este PAM ainda nao foi liberado." },
            { status: 403 },
          );

        const status = pam.status as PamStatus;
        if (status === "released") {
          await supabaseAdmin
            .from("pam")
            .update({
              status: "in_progress",
              first_accessed_at: pam.first_accessed_at ?? new Date().toISOString(),
            })
            .eq("id", pam.id);
        } else if (!pam.first_accessed_at) {
          await supabaseAdmin
            .from("pam")
            .update({ first_accessed_at: new Date().toISOString() })
            .eq("id", pam.id);
        }

        const { data: items } = await supabaseAdmin
          .from("pam_items")
          .select("*")
          .eq("pam_id", pam.id)
          .order("display_order", { ascending: true });

        return Response.json({
          ok: true,
          pam: {
            id: pam.id,
            employeeName: pam.employee_name,
            jobTitle: pam.job_title,
            feedbackDate: pam.feedback_date,
            status: status === "released" ? "in_progress" : status,
            completedAt: pam.completed_at,
          },
          editable: status !== "completed",
          items: items ?? [],
        });
      },
    },
  },
});
