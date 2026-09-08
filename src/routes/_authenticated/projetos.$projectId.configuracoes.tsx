import { createFileRoute, redirect } from "@tanstack/react-router";
import { ProjectConfigPage } from "@/components/ProjectConfigPage";
import { getCurrentUserSafely } from "@/lib/auth-safe";
import { apiJson } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/projetos/$projectId/configuracoes")({
  beforeLoad: async () => {
    const user = await getCurrentUserSafely();
    if (!user) throw redirect({ to: "/login" });
    const me = await apiJson<{ ok: boolean; permissions: { isAdmin: boolean } }>("/api/me");
    if (!me.permissions.isAdmin) throw redirect({ to: "/projetos" });
  },
  component: ConfigRoute,
});

function ConfigRoute() {
  const { projectId } = Route.useParams();
  return <ProjectConfigPage projectId={projectId} />;
}
