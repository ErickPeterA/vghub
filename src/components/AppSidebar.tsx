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
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";

export function AppSidebar() {
  const { isAdmin, profile, user } = useCurrentUser();
  const navigate = useNavigate();
  const path = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (p: string) => path === p || path.startsWith(p + "/");
  const [isGp, setIsGp] = useState(false);

  useEffect(() => {
    if (!user || isAdmin) {
      setIsGp(false);
      return;
    }
    let cancelled = false;
    supabase
      .from("project_members")
      .select("id")
      .eq("user_id", user.id)
      .eq("role", "gp")
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setIsGp(!!data);
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin, user]);

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

      <SidebarContent className="px-2">
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
      </SidebarContent>

      <SidebarFooter className="border-t border-white/10">
        <div className="flex items-center justify-between gap-2 px-2 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-2 group-data-[collapsible=icon]:hidden">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10">
              <span className="text-xs font-medium text-white">
                {profile?.nome ? profile.nome.charAt(0).toUpperCase() : "U"}
              </span>
            </div>
            <div className="min-w-0 flex-1 truncate">
              <div className="truncate text-sm font-medium text-white">{profile?.nome ?? "-"}</div>
              <div className="truncate text-xs text-white/40">{profile?.email}</div>
            </div>
          </div>

          <button
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/login" });
            }}
            className="rounded-lg bg-white/5 p-2 text-white/40 transition-all hover:bg-white/10 hover:text-white/80 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:justify-center"
            title="Sair"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
