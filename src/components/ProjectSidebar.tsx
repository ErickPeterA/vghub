import { Link, useRouterState } from "@tanstack/react-router";
import { Database, FileText, Library, LayoutDashboard, History, BarChart3, ArrowLeft, Network, Settings } from "lucide-react";

export function ProjectSidebar({ projectId, projectName, isAdmin }: { projectId: string; projectName: string; isAdmin?: boolean }) {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const items = [
    { to: "/projetos/$projectId/central", href: `/projetos/${projectId}/central`, icon: LayoutDashboard, label: "Página Central" },
    { to: "/projetos/$projectId/descricao-cargo", href: `/projetos/${projectId}/descricao-cargo`, icon: FileText, label: "Descrição de Cargo" },
    { to: "/projetos/$projectId/areas", href: `/projetos/${projectId}/areas`, icon: Network, label: "Áreas" },
    { to: "/projetos/$projectId/base", href: `/projetos/${projectId}/base`, icon: Database, label: "Base do Projeto" },
    { to: "/projetos/$projectId/andamento", href: `/projetos/${projectId}/andamento`, icon: BarChart3, label: "Andamento" },
    { to: "/projetos/$projectId/historico", href: `/projetos/${projectId}/historico`, icon: History, label: "Histórico" },
    ...(isAdmin ? [{ to: "/projetos/$projectId/configuracoes", href: `/projetos/${projectId}/configuracoes`, icon: Settings, label: "Configurações" }] : []),
  ] as const;
  return (
    <aside className="w-64 shrink-0 border-r border-border bg-card/30">
      <div className="border-b border-border p-4">
        <Link to="/projetos" className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
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
                active ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
              }`}
            >
              <it.icon className="h-4 w-4" /> {it.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
