import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/activity-form/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const token = params.token;
        if (!token || token.length < 20) {
          return Response.json({ error: "invalid_token", message: "Link inválido." }, { status: 400 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: link, error } = await supabaseAdmin
          .from("activity_links")
          .select("id,status,expires_at,label,config_id,answered_at")
          .eq("token", token)
          .maybeSingle();

        if (error) return Response.json({ error: "server_error", message: "Erro ao buscar link." }, { status: 500 });
        if (!link) return Response.json({ error: "not_found", message: "Este link não existe ou foi removido." }, { status: 404 });

        const now = new Date();
        const expired = new Date(link.expires_at) < now;

        if (link.status === "cancelled") {
          return Response.json({ error: "cancelled", message: "Este link foi cancelado pelo responsável." }, { status: 410 });
        }
        if (link.status === "answered") {
          return Response.json({ error: "already_answered", message: "Este formulário já foi respondido. Obrigado!" }, { status: 410 });
        }
        if (link.status === "expired" || expired) {
          if (link.status !== "expired") {
            await supabaseAdmin.from("activity_links").update({ status: "expired" }).eq("id", link.id);
          }
          return Response.json({ error: "expired", message: "Este link expirou. Solicite um novo ao responsável." }, { status: 410 });
        }

        const { data: config } = await supabaseAdmin
          .from("activity_configs")
          .select("header_schema,questions_schema,is_active")
          .eq("id", link.config_id)
          .maybeSingle();

        if (!config || !config.is_active) {
          return Response.json({ error: "inactive", message: "O formulário está inativo no momento." }, { status: 410 });
        }

        return Response.json({
          ok: true,
          label: link.label,
          header: config.header_schema,
          questions: config.questions_schema,
        });
      },
    },
  },
});
