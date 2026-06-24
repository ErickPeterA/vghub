import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/projetos/$projectId/descricao-cargo")({
  component: () => <Outlet />,
});
