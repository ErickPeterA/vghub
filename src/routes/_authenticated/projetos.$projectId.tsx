import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ProjectSidebar } from "@/components/ProjectSidebar";
import { withTimeout } from "@/lib/auth-safe";
import { useCurrentUser } from "@/hooks/use-current-user";

export const Route = createFileRoute("/_authenticated/projetos/$projectId")({
  component: ProjectLayout,
});

function ProjectLayout() {
  const { projectId } = Route.useParams();
  const { isAdmin } = useCurrentUser();
  const [name, setName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  // useRef para evitar que navigate mude a referencia e cause loop no useEffect
  const projectIdRef = useRef(projectId);
  projectIdRef.current = projectId;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    withTimeout(
      supabase
        .from("projects")
        .select("nome")
        .eq("id", projectIdRef.current)
        .maybeSingle(),
      10_000,
      "Nao foi possivel carregar o projeto.",
    )
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) throw error;
        if (!data) {
          setNotFound(true);
        } else {
          setName(data.nome);
        }
        setLoading(false);
      })
      .catch((error) => {
        if (cancelled) return;
        toast.error(error instanceof Error ? error.message : "Erro ao carregar projeto");
        setNotFound(true);
        setLoading(false);
      });
    return () => { cancelled = true; };
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
      <ProjectSidebar projectId={projectId} projectName={name} isAdmin={isAdmin} />
      <div className="min-w-0 flex-1 overflow-x-hidden">
        <Outlet />
      </div>
    </div>
  );
}
