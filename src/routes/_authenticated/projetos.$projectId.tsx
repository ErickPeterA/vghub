import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ProjectSidebar } from "@/components/ProjectSidebar";
import { useCurrentUser } from "@/hooks/use-current-user";
import { apiJson } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/projetos/$projectId")({
  component: ProjectLayout,
});

function ProjectLayout() {
  const { projectId } = Route.useParams();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { isAdmin } = useCurrentUser();
  const [name, setName] = useState<string>("");
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
      .then((payload) => {
        if (cancelled) return;
        setName(payload.project.nome);
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
    <div className="flex min-h-[calc(100vh-3rem)]">
      <ProjectSidebar
        projectId={projectId}
        projectName={name}
        isAdmin={isAdmin}
        fixed={!pathname.includes("/organograma")}
      />
      <div className="min-w-0 flex-1 overflow-x-hidden">
        <Outlet />
      </div>
    </div>
  );
}
