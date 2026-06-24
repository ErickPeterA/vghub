import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { ProjectListPage } from "@/components/ProjectListPage";

export const Route = createFileRoute("/_authenticated/projetos")({
  component: ProjetosLayout,
});

function ProjetosLayout() {
  const isIndex = useRouterState({
    select: (state) => state.matches[state.matches.length - 1]?.routeId === "/_authenticated/projetos",
  });
  return isIndex ? <ProjectListPage /> : <Outlet />;
}
