import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { apiJson } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/projetos/$projectId")({
  component: ProjectLayout,
});

function ProjectLayout() {
  const { projectId } = Route.useParams();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const projectIdRef = useRef(projectId);
  projectIdRef.current = projectId;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);

    apiJson<{ ok: boolean; project: { id: string; nome: string } }>(
      `/api/projects/${projectIdRef.current}`,
    )
      .then(() => {
        if (cancelled) return;
        setLoading(false);
      })
      .catch((error) => {
        if (cancelled) return;
        toast.error(error instanceof Error ? error.message : "Erro ao carregar projeto");
        setNotFound(true);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Carregando projeto...
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Projeto nao encontrado.
      </div>
    );
  }

  return (
    <div className="min-w-0 overflow-x-hidden">
      <Outlet />
    </div>
  );
}
