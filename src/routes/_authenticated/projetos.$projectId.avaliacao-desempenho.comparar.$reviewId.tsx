import { createFileRoute } from "@tanstack/react-router";
import { PerformanceComparisonPage } from "@/components/PerformanceReviewManager";

export const Route = createFileRoute(
  "/_authenticated/projetos/$projectId/avaliacao-desempenho/comparar/$reviewId",
)({
  component: CompararAvaliacaoPage,
});

function CompararAvaliacaoPage() {
  const { projectId, reviewId } = Route.useParams();
  return <PerformanceComparisonPage projectId={projectId} reviewId={reviewId} />;
}
