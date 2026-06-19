import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ProjectSidebar } from "@/components/ProjectSidebar";

export const Route = createFileRoute("/_authenticated/projetos/$projectId")({
  component: ProjectLayout,
});

function ProjectLayout() {
  const { projectId } = Route.useParams();
  const [name, setName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  // useRef para evitar que navigate mude a referência e cause loop no useEffect
  const projectIdRef = useRef(projectId);
  projectIdRef.current = projectId;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    supabase
      .from("projects")
      .select("nome")
      .eq("id", projectIdRef.current)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        if (!data) {
          setNotFound(true);
        } else {
          setName(data.nome);
        }
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
        Projeto não encontrado.
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-3rem)]">
      <ProjectSidebar projectId={projectId} projectName={name} />
      <div className="flex-1 overflow-x-auto">
        <Outlet />
      </div>
    </div>
  );
}
