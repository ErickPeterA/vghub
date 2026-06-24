import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/projetos/$projectId/")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/projetos/$projectId/central", params, replace: true });
  },
  component: () => null,
});
