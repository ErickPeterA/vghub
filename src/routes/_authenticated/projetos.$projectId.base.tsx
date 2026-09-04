import { createFileRoute, redirect } from "@tanstack/react-router";
import { ProjectModelsManager } from "@/components/ProjectModelsManager";
import { apiJson } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/projetos/$projectId/base")({
  beforeLoad: async ({ params }) => {
    try {
      await apiJson(`/api/base/access?projectId=${encodeURIComponent(params.projectId)}`);
    } catch {
      throw redirect({ to: "/projetos" });
    }
  },
  component: ProjectBasePage,
});

function ProjectBasePage() {
  const { projectId } = Route.useParams();
  return <ProjectModelsManager projectId={projectId} />;
}
