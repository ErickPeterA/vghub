import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ProjectSidebar } from "@/components/ProjectSidebar";

export const Route = createFileRoute("/_authenticated/projetos/$projectId")({
  component: ProjectLayout,
});

function ProjectLayout() {
  const { projectId } = Route.useParams();
  const [name, setName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.from("projects").select("nome").eq("id", projectId).maybeSingle().then(({ data }) => {
      if (!data) navigate({ to: "/projetos" });
      else setName(data.nome);
      setLoading(false);
    });
  }, [projectId, navigate]);

  if (loading) return <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">Carregando projeto...</div>;

  return (
    <div className="flex min-h-[calc(100vh-3rem)]">
      <ProjectSidebar projectId={projectId} projectName={name} />
      <div className="flex-1 overflow-x-auto">
        <Outlet />
      </div>
    </div>
  );
}
