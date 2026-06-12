import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { Database, FolderKanban, Users, UserPlus, LinkIcon, LogOut, ChevronDown } from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";

export function AppSidebar() {
  const { isAdmin, profile } = useCurrentUser();
  const navigate = useNavigate();
  const path = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (p: string) => path === p || path.startsWith(p + "/");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1">
          <div className="h-2 w-2 rounded-full bg-accent" />
          <span className="font-display text-lg">Estrutura DC</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/projetos")}>
                  <Link to="/projetos"><FolderKanban /> <span>Projetos</span></Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <Collapsible defaultOpen={isActive("/gerenciamento")} className="group/coll">
            <SidebarGroup>
              <CollapsibleTrigger asChild>
                <SidebarGroupLabel className="cursor-pointer">
                  Gerenciamento <ChevronDown className="ml-auto h-3 w-3 transition group-data-[state=open]/coll:rotate-180" />
                </SidebarGroupLabel>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={path === "/gerenciamento/usuarios"}>
                        <Link to="/gerenciamento/usuarios"><Users /> <span>Gerenciar Usuários</span></Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={path === "/gerenciamento/usuarios/novo"}>
                        <Link to="/gerenciamento/usuarios/novo"><UserPlus /> <span>Criar Login</span></Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={path === "/gerenciamento/atrelar"}>
                        <Link to="/gerenciamento/atrelar"><LinkIcon /> <span>Atrelar Usuários</span></Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={path === "/gerenciamento/bases"}>
                        <Link to="/gerenciamento/bases"><Database /> <span>Configuração das Bases</span></Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        )}
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center justify-between gap-2 px-2 py-2 text-xs">
          <div className="min-w-0 flex-1 truncate">
            <div className="truncate font-medium">{profile?.nome ?? "—"}</div>
            <div className="truncate text-muted-foreground">{profile?.email}</div>
          </div>
          <button
            onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/login" }); }}
            className="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-secondary"
            title="Sair"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
