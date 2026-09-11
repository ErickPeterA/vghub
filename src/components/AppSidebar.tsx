import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ChevronDown,
  Database,
  FolderKanban,
  LinkIcon,
  LogOut,
  UserPlus,
  Users,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { apiJson } from "@/lib/api";
import { useCurrentUser } from "@/hooks/use-current-user";
import { ProjectSidebar } from "@/components/ProjectSidebar";

export function AppSidebar() {
  const { isAdmin, profile, user } = useCurrentUser();
  const navigate = useNavigate();
  const path = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (p: string) => path === p || path.startsWith(p + "/");
  const [isGp, setIsGp] = useState(false);
  const projectId = path.match(/^\/projetos\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\/|$)/i)?.[1];
  const [projectName, setProjectName] = useState("");

  useEffect(() => {
    if (!user || isAdmin) {
      setIsGp(false);
      return;
    }
    let cancelled = false;
    apiJson<{ ok: boolean; isGp: boolean }>("/api/navigation")
      .then(({ isGp }) => {
        if (!cancelled) setIsGp(isGp);
      })
      .catch(() => {
        if (!cancelled) setIsGp(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin, user]);

  useEffect(() => {
    if (!projectId) {
      setProjectName("");
      return;
    }

    let cancelled = false;
    setProjectName("");
    apiJson<{ ok: boolean; project: { id: string; nome: string } }>(`/api/projects/${projectId}`)
      .then(({ project }) => {
        if (!cancelled) setProjectName(project.nome);
      })
      .catch(() => {
        if (!cancelled) setProjectName("Projeto");
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-[#042558]/10 bg-gradient-to-b from-[#042558] to-[#0a3a7a] text-white"
    >
      <SidebarHeader className="border-b border-white/10 p-0">
        <div className="flex items-center justify-center px-2 py-3">
          <img
            src="/logobranca.png"
            alt="Logo"
            className="hidden h-[1rem] w-auto object-cover group-data-[collapsible=icon]:block"
          />
          <img
            src="/logobranca.png"
            alt="VG Hub"
            className="block w-30 object-contain group-data-[collapsible=icon]:hidden"
          />
        </div>
      </SidebarHeader>

      <SidebarContent className={projectId ? "px-0" : "px-2"}>
        {projectId ? (
          <ProjectSidebar
            projectId={projectId}
            projectName={projectName || "Carregando..."}
            isAdmin={isAdmin}
            embedded
          />
        ) : (
          <>
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-medium uppercase tracking-wider text-white/40 group-data-[collapsible=icon]:hidden">
            Principal
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/projetos")}
                  className="text-white/70 hover:bg-white/10 hover:text-white data-[active=true]:bg-white/15 data-[active=true]:text-white data-[active=true]:shadow-lg data-[active=true]:shadow-black/10 group-data-[collapsible=icon]:justify-center"
                >
                  <Link to="/projetos">
                    <FolderKanban className="h-4 w-4" strokeWidth={1.5} />
                    <span className="group-data-[collapsible=icon]:hidden">Projetos</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {(isAdmin || isGp) && (
          <Collapsible defaultOpen={isActive("/gerenciamento")} className="group/coll">
            <SidebarGroup>
              <CollapsibleTrigger asChild>
                <SidebarGroupLabel className="cursor-pointer text-xs font-medium uppercase tracking-wider text-white/40 transition-colors hover:text-white/60 group-data-[collapsible=icon]:hidden">
                  Gerenciamento
                  <ChevronDown className="ml-auto h-3 w-3 text-white/40 transition-transform duration-200 group-data-[state=open]/coll:rotate-180" />
                </SidebarGroupLabel>
              </CollapsibleTrigger>
              <CollapsibleContent className="group-data-[collapsible=icon]:hidden">
                <SidebarGroupContent>
                  <SidebarMenu>
                    {isAdmin && (
                      <>
                        <SidebarMenuItem>
                          <SidebarMenuButton
                            asChild
                            isActive={path === "/gerenciamento/usuarios"}
                            className="text-white/70 hover:bg-white/10 hover:text-white data-[active=true]:bg-white/15 data-[active=true]:text-white data-[active=true]:shadow-lg data-[active=true]:shadow-black/10"
                          >
                            <Link to="/gerenciamento/usuarios">
                              <Users className="h-4 w-4" strokeWidth={1.5} />
                              <span>Gerenciar Usuarios</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                        <SidebarMenuItem>
                          <SidebarMenuButton
                            asChild
                            isActive={path === "/gerenciamento/usuarios/novo"}
                            className="text-white/70 hover:bg-white/10 hover:text-white data-[active=true]:bg-white/15 data-[active=true]:text-white data-[active=true]:shadow-lg data-[active=true]:shadow-black/10"
                          >
                            <Link to="/gerenciamento/usuarios/novo">
                              <UserPlus className="h-4 w-4" strokeWidth={1.5} />
                              <span>Criar Login</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                        <SidebarMenuItem>
                          <SidebarMenuButton
                            asChild
                            isActive={path === "/gerenciamento/atrelar"}
                            className="text-white/70 hover:bg-white/10 hover:text-white data-[active=true]:bg-white/15 data-[active=true]:text-white data-[active=true]:shadow-lg data-[active=true]:shadow-black/10"
                          >
                            <Link to="/gerenciamento/atrelar">
                              <LinkIcon className="h-4 w-4" strokeWidth={1.5} />
                              <span>Atrelar Usuarios</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      </>
                    )}
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive={path === "/gerenciamento/bases"}
                        className="text-white/70 hover:bg-white/10 hover:text-white data-[active=true]:bg-white/15 data-[active=true]:text-white data-[active=true]:shadow-lg data-[active=true]:shadow-black/10"
                      >
                        <Link to="/gerenciamento/bases">
                          <Database className="h-4 w-4" strokeWidth={1.5} />
                          <span>Configurar Modelos</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        )}
          </>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-white/10 p-1.5">
        <div className="flex items-center justify-between gap-1.5 px-1 py-1.5">
          <div className="flex min-w-0 flex-1 items-center gap-1.5 group-data-[collapsible=icon]:hidden">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10">
              <span className="text-[10px] font-medium text-white">
                {profile?.nome ? profile.nome.charAt(0).toUpperCase() : "U"}
              </span>
            </div>
            <div className="min-w-0 flex-1 truncate">
              <div className="truncate text-xs font-medium leading-tight text-white">
                {profile?.nome ?? "-"}
              </div>
              <div className="truncate text-[10px] leading-tight text-white/40">{profile?.email}</div>
            </div>
          </div>

          <button
            onClick={async () => {
              await apiJson<{ ok: true }>("/api/auth/logout", { method: "POST" });
              await navigate({ to: "/login" });
              window.location.reload();
            }}
            className="rounded-lg bg-white/5 p-1.5 text-white/40 transition-all hover:bg-white/10 hover:text-white/80 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:justify-center"
            title="Sair"
          >
            <LogOut className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
