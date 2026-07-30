import { createFileRoute } from "@tanstack/react-router";
import { DCListPage } from "@/components/DCListPage";

export const Route = createFileRoute("/_authenticated/projetos/$projectId/descricao-cargo/")({
  component: DCListIndex,
});

function DCListIndex() {
  const { projectId } = Route.useParams();
  return <DCListPage projectId={projectId} />;
}
