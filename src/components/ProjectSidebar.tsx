import { Link, useRouterState } from "@tanstack/react-router";
import {
  ArrowLeft,
  BarChart3,
  ClipboardCheck,
  ClipboardList,
  FileText,
  GitFork,
  History,
  Layers,
  Network,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";

const LIDER_ROLES = new Set([
  "lider_estrategico",
  "lider_tatico",
  "lider_operacional",
  "lider_superior",
  "lider_setor",
]);

export function ProjectSidebar({
  projectId,
  projectName,
  isAdmin,
  fixed = false,
}: {
  projectId: string;
  projectName: string;
  isAdmin?: boolean;
  fixed?: boolean;
}) {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { user } = useCurrentUser();
  const [unreviewed, setUnreviewed] = useState(0);
  const [projectRole, setProjectRole] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { count } = await supabase
        .from("activity_links")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId)
        .eq("status", "answered")
        .is("reviewed_at", null);
      if (!cancelled) setUnreviewed(count ?? 0);
    };
    void load();
    const iv = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [projectId]);

  useEffect(() => {
    if (!user) return;
    void supabase
      .from("project_members")
      .select("role")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setProjectRole(data?.role ?? null));
  }, [projectId, user]);

  const isLider = !isAdmin && projectRole !== null && LIDER_ROLES.has(projectRole);
  const canManageProjectModels = isAdmin || projectRole === "gp" || projectRole === "admin";

  const allItems = [
    {
      to: "/projetos/$projectId/descricao-cargo",
      href: `/projetos/${projectId}/descricao-cargo`,
      icon: FileText,
      label: "Aprovações",
    },
    {
      to: "/projetos/$projectId/atividades",
      href: `/projetos/${projectId}/atividades`,
      icon: ClipboardList,
      label: "Atividades",
      badge: unreviewed,
    },
    {
      to: "/projetos/$projectId/avaliacao-desempenho",
      href: `/projetos/${projectId}/avaliacao-desempenho`,
      icon: ClipboardCheck,
      label: "Avaliacoes",
    },
    {
      to: "/projetos/$projectId/organograma",
      href: `/projetos/${projectId}/organograma`,
      icon: GitFork,
      label: "Organograma",
    },
    {
      to: "/projetos/$projectId/colaboradores",
      href: `/projetos/${projectId}/colaboradores`,
      icon: Users,
      label: "Colaboradores",
    },
    {
      to: "/projetos/$projectId/areas",
      href: `/projetos/${projectId}/areas`,
      icon: Network,
      label: "Áreas",
    },
    ...(canManageProjectModels
      ? [
          {
            to: "/projetos/$projectId/base",
            href: `/projetos/${projectId}/base`,
            icon: Layers,
            label: "Configurações",
          },
        ]
      : []),
    {
      to: "/projetos/$projectId/andamento",
      href: `/projetos/${projectId}/andamento`,
      icon: BarChart3,
      label: "Andamento",
    },
    {
      to: "/projetos/$projectId/historico",
      href: `/projetos/${projectId}/historico`,
      icon: History,
      label: "Histórico",
    },
    ...(isAdmin
      ? [
          {
            to: "/projetos/$projectId/configuracoes",
            href: `/projetos/${projectId}/configuracoes`,
            icon: Settings,
            label: "Permissões",
          },
        ]
      : []),
  ] as Array<{ to: string; href: string; icon: LucideIcon; label: string; badge?: number }>;

  const items = isLider
    ? allItems.filter(
        (i) =>
          i.href.endsWith("/descricao-cargo") ||
          i.label === "Organograma" ||
          i.label === "Colaboradores" ||
          i.label === "Andamento",
      )
    : allItems;

  return (
    <aside
      className={`w-64 shrink-0 border-r border-border bg-card/30 ${fixed ? "sticky top-12 h-[calc(100vh-3rem)] overflow-y-auto" : ""}`}
    >
      <div className="border-b border-border p-4">
        <Link
          to="/projetos"
          className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Todos os projetos
        </Link>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Projeto</p>
        <h2 className="mt-1 font-display text-xl leading-tight">{projectName}</h2>
      </div>
      <nav className="p-2">
        {items.map((it) => {
          const active = path === it.href || path.startsWith(it.href + "/");
          return (
            <Link
              key={it.to}
              to={it.to}
              params={{ projectId }}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition ${
                active
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
              }`}
            >
              <it.icon className="h-4 w-4" />
              <span className="flex-1">{it.label}</span>
              {it.badge && it.badge > 0 ? (
                <span className="rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {it.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
