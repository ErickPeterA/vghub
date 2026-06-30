import { createFileRoute } from "@tanstack/react-router";
import { AreasManager } from "@/components/AreasManager";

export const Route = createFileRoute("/_authenticated/projetos/$projectId/areas")({
  component: AreasPage,
});

function AreasPage() {
  const { projectId } = Route.useParams();
  return <AreasManager projectId={projectId} />;
}
