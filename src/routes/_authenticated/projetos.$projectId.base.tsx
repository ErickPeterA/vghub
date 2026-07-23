import { createFileRoute } from "@tanstack/react-router";
import { BaseManager } from "@/components/BaseManager";

export const Route = createFileRoute("/_authenticated/projetos/$projectId/base")({
  component: ProjectBasePage,
});

function ProjectBasePage() {
  const { projectId } = Route.useParams();
  return (
    <BaseManager
      projectId={projectId}
      title="Base do Projeto"
      description="Edite, desative, remova ou acrescente campos e opcoes sem alterar a Base Geral nem outros projetos."
    />
  );
}
