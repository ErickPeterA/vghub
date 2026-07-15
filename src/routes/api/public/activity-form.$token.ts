import { createFileRoute } from "@tanstack/react-router";

type ActivityField = {
  id: string;
  label: string;
  type: "text" | "textarea" | "date" | "select";
  required: boolean;
  active?: boolean;
  options?: string[];
  filledBy?: "gp" | "collaborator";
  helpText?: string;
  dataSource?: "manual" | "areas" | "setores";
};

const normalizeActivityFields = (fields: ActivityField[]) =>
  fields.flatMap((field) => {
    const normalized = { ...field, active: field.active ?? true, dataSource: field.dataSource ?? "manual" };
    const key = `${field.id} ${field.label}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    if (key.includes("area_setor") || key.includes("area e setor")) {
      return [
        { ...normalized, id: "area", label: "Área", type: "select" as const, dataSource: "areas" as const },
        { ...normalized, id: "setor", label: "Setor", type: "select" as const, dataSource: "setores" as const },
      ];
    }
    return [normalized];
  });

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
          .select("id,project_id,status,expires_at,label,config_id,answered_at,header_answers,draft_header_answers,draft_question_answers,draft_saved_at")
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

        const header = Array.isArray(config.header_schema) ? normalizeActivityFields(config.header_schema as ActivityField[]).filter((field) => field?.active ?? true) : config.header_schema;
        const questions = Array.isArray(config.questions_schema) ? normalizeActivityFields(config.questions_schema as ActivityField[]).filter((field) => field?.active ?? true) : config.questions_schema;
        const { data: areas } = await supabaseAdmin
          .from("project_areas")
          .select("id,parent_id,nome,cor")
          .eq("project_id", link.project_id)
          .order("display_order")
          .order("created_at");

        return Response.json({
          ok: true,
          label: link.label,
          prefilledHeader: link.header_answers ?? {},
          draftHeader: link.draft_header_answers ?? {},
          draftQuestions: link.draft_question_answers ?? {},
          draftSavedAt: link.draft_saved_at,
          areas: areas ?? [],
          header,
          questions,
        });
      },
    },
  },
});
