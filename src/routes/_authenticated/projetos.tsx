import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { ProjectListPage } from "@/components/ProjectListPage";

export const Route = createFileRoute("/_authenticated/projetos")({
  component: ProjetosLayout,
});

function ProjetosLayout() {
  const isIndex = useRouterState({
    select: (state) =>
      state.location.pathname === "/projetos" || state.location.pathname === "/projetos/",
  });
  return isIndex ? <ProjectListPage /> : <Outlet />;
}
