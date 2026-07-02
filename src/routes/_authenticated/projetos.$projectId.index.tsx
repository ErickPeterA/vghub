import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/projetos/$projectId/")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/projetos/$projectId/descricao-cargo", params, replace: true });
  },
  component: () => null,
});
