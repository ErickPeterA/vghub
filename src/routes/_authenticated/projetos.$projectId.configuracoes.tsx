import { createFileRoute, redirect } from "@tanstack/react-router";
import { ProjectConfigPage } from "@/components/ProjectConfigPage";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUserSafely, withTimeout } from "@/lib/auth-safe";

export const Route = createFileRoute("/_authenticated/projetos/$projectId/configuracoes")({
  beforeLoad: async () => {
    const user = await getCurrentUserSafely();
    if (!user) throw redirect({ to: "/login" });
    const { data } = await withTimeout(
      supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle(),
      8_000,
      "Não foi possível validar permissões.",
    );
    if (!data) throw redirect({ to: "/projetos" });
  },
  component: ConfigRoute,
});

function ConfigRoute() {
  const { projectId } = Route.useParams();
  return <ProjectConfigPage projectId={projectId} />;
}
