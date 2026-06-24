import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { DCListPage } from "@/components/DCListPage";

export const Route = createFileRoute("/_authenticated/projetos/$projectId/descricao-cargo")({
  component: DescricaoCargoLayout,
});

function DescricaoCargoLayout() {
  const { projectId } = Route.useParams();
  const isIndex = useRouterState({
    select: (state) => state.location.pathname === `/projetos/${projectId}/descricao-cargo` || state.location.pathname === `/projetos/${projectId}/descricao-cargo/`,
  });
  return isIndex ? <DCListPage projectId={projectId} /> : <Outlet />;
}
