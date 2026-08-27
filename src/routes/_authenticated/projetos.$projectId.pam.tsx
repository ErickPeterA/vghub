import { createFileRoute } from "@tanstack/react-router";
import { PamManager } from "@/components/PamManager";

export const Route = createFileRoute("/_authenticated/projetos/$projectId/pam")({
  component: PamPage,
});

function PamPage() {
  const { projectId } = Route.useParams();
  return <PamManager projectId={projectId} />;
}
