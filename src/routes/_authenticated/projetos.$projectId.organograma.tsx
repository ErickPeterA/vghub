import { createFileRoute } from "@tanstack/react-router";
import { OrganizationManager } from "@/components/organization/OrganizationManager";

export const Route = createFileRoute("/_authenticated/projetos/$projectId/organograma")({
  component: OrganizationPage,
});

function OrganizationPage() {
  const { projectId } = Route.useParams();
  return <OrganizationManager projectId={projectId} />;
}
