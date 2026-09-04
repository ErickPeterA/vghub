import { createFileRoute, redirect } from "@tanstack/react-router";
import { ProjectModelsManager } from "@/components/ProjectModelsManager";
import { apiJson } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/gerenciamento/bases")({
  beforeLoad: async () => {
    try {
      await apiJson("/api/base/access");
    } catch {
      throw redirect({ to: "/projetos" });
    }
  },
  component: GeneralModelsPage,
});

function GeneralModelsPage() {
  return <ProjectModelsManager />;
}
