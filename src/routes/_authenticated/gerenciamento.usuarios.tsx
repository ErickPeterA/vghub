import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { UsersManagementPage } from "@/components/UsersManagementPage";

export const Route = createFileRoute("/_authenticated/gerenciamento/usuarios")({
  component: UsuariosLayout,
});

function UsuariosLayout() {
  const isIndex = useRouterState({
    select: (state) => state.matches[state.matches.length - 1]?.routeId === "/_authenticated/gerenciamento/usuarios",
  });
  return isIndex ? <UsersManagementPage /> : <Outlet />;
}
