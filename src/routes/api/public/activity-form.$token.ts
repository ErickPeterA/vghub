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
    const normalized = {
      ...field,
      active: field.active ?? true,
      dataSource: field.dataSource ?? "manual",
    };
    const key = `${field.id} ${field.label}`
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    if (key.includes("area_setor") || key.includes("area e setor")) {
      return [
        {
          ...normalized,
          id: "area",
          label: "Area",
          type: "select" as const,
          dataSource: "areas" as const,
        },
        {
          ...normalized,
          id: "setor",
          label: "Setor",
          type: "select" as const,
          dataSource: "setores" as const,
        },
      ];
    }
    return [normalized];
  });

export const Route = createFileRoute("/api/public/activity-form/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          const { getPublicActivityForm } = await import("@/server/activities/activity-repository");
          const data = await getPublicActivityForm(params.token);
          const header = Array.isArray(data.header)
            ? normalizeActivityFields(data.header as ActivityField[]).filter(
                (field) => field?.active ?? true,
              )
            : data.header;
          const questions = Array.isArray(data.questions)
            ? normalizeActivityFields(data.questions as ActivityField[]).filter(
                (field) => field?.active ?? true,
              )
            : data.questions;

          return Response.json({
            ok: true,
            ...data,
            header,
            questions,
          });
        } catch (error) {
          const { toErrorResponse } = await import("@/server/http/errors");
          return toErrorResponse(error);
        }
      },
    },
  },
});
