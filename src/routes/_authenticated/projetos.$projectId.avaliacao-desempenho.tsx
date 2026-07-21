import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { PerformanceReviewManager } from "@/components/PerformanceReviewManager";

export const Route = createFileRoute("/_authenticated/projetos/$projectId/avaliacao-desempenho")({
  component: AvaliacaoDesempenhoPage,
});

function AvaliacaoDesempenhoPage() {
  const { projectId } = Route.useParams();
  const isIndex = useRouterState({
    select: (state) =>
      state.location.pathname === `/projetos/${projectId}/avaliacao-desempenho` ||
      state.location.pathname === `/projetos/${projectId}/avaliacao-desempenho/`,
  });

  return isIndex ? <PerformanceReviewManager projectId={projectId} /> : <Outlet />;
}
