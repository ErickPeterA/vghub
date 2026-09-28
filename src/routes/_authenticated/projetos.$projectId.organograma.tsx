import { createFileRoute } from "@tanstack/react-router";
import { FreeOrganizationManager as OrganizationManager } from "@/components/organization/FreeOrganizationManager";

export const Route = createFileRoute("/_authenticated/projetos/$projectId/organograma")({
  component: OrganizationPage,
});

function OrganizationPage() {
  const { projectId } = Route.useParams();
  return <OrganizationManager projectId={projectId} />;
}
