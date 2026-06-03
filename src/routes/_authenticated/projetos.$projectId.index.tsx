import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/_authenticated/projetos/$projectId/")({
  component: () => {
    const { projectId } = Route.useParams();
    const navigate = useNavigate();
    useEffect(() => { navigate({ to: "/projetos/$projectId/central", params: { projectId }, replace: true }); }, [projectId, navigate]);
    return null;
  },
});
