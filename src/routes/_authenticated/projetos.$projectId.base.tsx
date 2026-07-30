import { createFileRoute, redirect } from "@tanstack/react-router";
import { ProjectModelsManager } from "@/components/ProjectModelsManager";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUserSafely, withTimeout } from "@/lib/auth-safe";

export const Route = createFileRoute("/_authenticated/projetos/$projectId/base")({
  beforeLoad: async ({ params }) => {
    const user = await getCurrentUserSafely();
    if (!user) throw redirect({ to: "/login" });

    const [{ data: adminRole }, { data: projectRole }] = await withTimeout(
      Promise.all([
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle(),
        supabase
          .from("project_members")
          .select("role")
          .eq("project_id", params.projectId)
          .eq("user_id", user.id)
          .in("role", ["gp", "admin"])
          .maybeSingle(),
      ]),
      8_000,
      "Nao foi possivel validar permissoes.",
    );

    if (!adminRole && !projectRole) throw redirect({ to: "/projetos" });
  },
  component: ProjectBasePage,
});

function ProjectBasePage() {
  const { projectId } = Route.useParams();
  return <ProjectModelsManager projectId={projectId} />;
}
