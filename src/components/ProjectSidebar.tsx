import { Link, useRouterState } from "@tanstack/react-router";
import {
  ArrowLeft,
  BarChart3,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  FileText,
  GitFork,
  History,
  Layers,
  ListChecks,
  Network,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { apiJson } from "@/lib/api";

const LIDER_ROLES = new Set([
  "lider_estrategico",
  "lider_tatico",
  "lider_operacional",
  "lider_superior",
  "lider_setor",
]);

const SIDEBAR_GROUPS = [
  "EMPRESA",
  "PLANO DE CARREIRA",
  "AVALIAÇÕES",
  "GESTÃO DO PROJETO",
  "CONFIGURAÇÕES",
] as const;

type SidebarGroup = (typeof SIDEBAR_GROUPS)[number];
type SidebarItem = {
  to: string;
  href: string;
  icon: LucideIcon;
  label: string;
  group: SidebarGroup;
  badge?: number;
};

export function ProjectSidebar({
  projectId,
  projectName,
  isAdmin,
  fixed = false,
  embedded = false,
}: {
  projectId: string;
  projectName: string;
  isAdmin?: boolean;
  fixed?: boolean;
  embedded?: boolean;
}) {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const [unreviewed, setUnreviewed] = useState(0);
  const [projectRole, setProjectRole] = useState<string | null>(null);
  const [openGroups, setOpenGroups] = useState<Record<SidebarGroup, boolean>>(() =>
    SIDEBAR_GROUPS.reduce(
      (acc, group) => ({ ...acc, [group]: false }),
      {} as Record<SidebarGroup, boolean>,
    ),
  );

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const data = await apiJson<{ ok: boolean; unreviewed: number; projectRole: string | null }>(
        `/api/projects/${projectId}/navigation`,
      );
      if (!cancelled) {
        setUnreviewed(data.unreviewed);
        setProjectRole(data.projectRole);
      }
    };
    void load();
    const iv = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [projectId]);

  const isLider = !isAdmin && projectRole !== null && LIDER_ROLES.has(projectRole);
  const canManageProjectModels = isAdmin || projectRole === "gp" || projectRole === "admin";

  const allItems = [
    {
      to: "/projetos/$projectId/areas",
      href: `/projetos/${projectId}/areas`,
      icon: Network,
      label: "Áreas e setores",
      group: "EMPRESA",
    },
    {
      to: "/projetos/$projectId/colaboradores",
      href: `/projetos/${projectId}/colaboradores`,
      icon: Users,
      label: "Colaboradores",
      group: "EMPRESA",
    },
    {
      to: "/projetos/$projectId/organograma",
      href: `/projetos/${projectId}/organograma`,
      icon: GitFork,
      label: "Organograma e descrição de cargo",
      group: "PLANO DE CARREIRA",
    },
    {
      to: "/projetos/$projectId/atividades",
      href: `/projetos/${projectId}/atividades`,
      icon: ClipboardList,
      label: "Coleta de dados",
      group: "PLANO DE CARREIRA",
      badge: unreviewed,
    },
    {
      to: "/projetos/$projectId/descricao-cargo",
      href: `/projetos/${projectId}/descricao-cargo`,
      icon: FileText,
      label: "Aprovações",
      group: "PLANO DE CARREIRA",
    },
    {
      to: "/projetos/$projectId/avaliacao-desempenho",
      href: `/projetos/${projectId}/avaliacao-desempenho`,
      icon: ClipboardCheck,
      label: "Avaliações",
      group: "AVALIAÇÕES",
    },
    {
      to: "/projetos/$projectId/pam",
      href: `/projetos/${projectId}/pam`,
      icon: ListChecks,
      label: "PAM",
      group: "AVALIAÇÕES",
    },
    ...(canManageProjectModels
      ? [
          {
            to: "/projetos/$projectId/base",
            href: `/projetos/${projectId}/base`,
            icon: Layers,
            label: "Configurações",
            group: "CONFIGURAÇÕES" as const,
          },
        ]
      : []),
    {
      to: "/projetos/$projectId/andamento",
      href: `/projetos/${projectId}/andamento`,
      icon: BarChart3,
      label: "Andamento",
      group: "GESTÃO DO PROJETO",
    },
    {
      to: "/projetos/$projectId/historico",
      href: `/projetos/${projectId}/historico`,
      icon: History,
      label: "Histórico",
      group: "GESTÃO DO PROJETO",
    },
    ...(isAdmin
      ? [
          {
            to: "/projetos/$projectId/configuracoes",
            href: `/projetos/${projectId}/configuracoes`,
            icon: Settings,
            label: "Permissões",
            group: "CONFIGURAÇÕES" as const,
          },
        ]
      : []),
  ] satisfies SidebarItem[];

  const items = isLider
    ? allItems.filter(
        (i) =>
          i.href.endsWith("/descricao-cargo") ||
          i.href.endsWith("/pam") ||
          i.href.endsWith("/organograma") ||
          i.href.endsWith("/colaboradores") ||
          i.href.endsWith("/andamento"),
      )
    : allItems;

  const groupedItems = SIDEBAR_GROUPS.map((group) => ({
    group,
    items: items.filter((item) => item.group === group),
  })).filter((section) => section.items.length > 0);

  const toggleGroup = (group: SidebarGroup) => {
    setOpenGroups((current) => ({
      ...current,
      [group]: !current[group],
    }));
  };

  const content = (
    <>
      <div className="border-b border-border p-4">
        <Link
          to="/projetos"
          className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          <span>Todos os projetos</span>
        </Link>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Projeto</p>
        <h2 className="mt-1 font-display text-sm font-medium leading-tight">{projectName}</h2>
      </div>
      <nav className="space-y-2 p-2">
        {groupedItems.map((section) => (
          <div key={section.group}>
            <button
              type="button"
              onClick={() => toggleGroup(section.group)}
              aria-expanded={openGroups[section.group]}
              className="mb-1 flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground transition hover:bg-secondary/50 hover:text-foreground"
            >
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${
                  openGroups[section.group] ? "rotate-0" : "-rotate-90"
                }`}
              />
              <span className="flex-1">{section.group}</span>
            </button>
            {openGroups[section.group] && (
              <div className="space-y-1">
                {section.items.map((it) => {
                  const active = path === it.href || path.startsWith(it.href + "/");
                  return (
                    <Link
                      key={it.to}
                      to={it.to}
                      params={{ projectId }}
                      className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs transition ${
                        active
                          ? "bg-secondary text-foreground"
                          : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                      }`}
                    >
                      <it.icon className="h-3.5 w-3.5" />
                      <span className="flex-1">{it.label}</span>
                      {it.badge && it.badge > 0 ? (
                        <span className="rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                          {it.badge}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </nav>
    </>
  );

  if (embedded) {
    return (
      <div className="w-full text-white [&_.border-border]:border-white/10 [&_.bg-secondary]:bg-white/15 [&_.text-foreground]:text-white [&_.text-muted-foreground]:text-white/50 [&_a:hover]:bg-white/10 [&_button:hover]:bg-white/10 group-data-[collapsible=icon]:[&_h2]:hidden group-data-[collapsible=icon]:[&_nav_button]:hidden group-data-[collapsible=icon]:[&_p]:hidden group-data-[collapsible=icon]:[&_span]:hidden group-data-[collapsible=icon]:[&_.border-b]:px-2 group-data-[collapsible=icon]:[&_a]:justify-center group-data-[collapsible=icon]:[&_a]:px-2">
        {content}
      </div>
    );
  }

  return (
    <aside
      className={`w-64 shrink-0 border-r border-border bg-card/30 ${fixed ? "sticky top-12 h-[calc(100vh-3rem)] overflow-y-auto" : ""}`}
    >
      {content}
    </aside>
  );
}
