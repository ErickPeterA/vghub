import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  attachUserToProjectAdmin,
  removeProjectMemberAdmin,
  updateProjectMemberRoleAdmin,
  type ProjectRoleValue,
} from "@/lib/admin.functions";

type Profile = { id: string; nome: string; email: string };
type Area = { id: string; nome: string; parent_id: string | null };
type Scope = { id: string; member_id: string; area_id: string };
type Member = {
  id: string;
  user_id: string;
  role: ProjectRoleValue;
  profile: Profile | null;
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin do projeto",
  gp: "GP",
  lider_superior: "Líder Superior",
  lider_setor: "Líder de Setor",
  usuario_comum: "Usuário Comum",
  lider_estrategico: "Líder Estratégico (legado)",
  lider_tatico: "Líder Tático (legado)",
  lider_operacional: "Líder Operacional (legado)",
};
const ROLE_OPTIONS: ProjectRoleValue[] = ["admin", "gp", "lider_superior", "lider_setor", "usuario_comum"];

const inp = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

export function ProjectConfigPage({ projectId }: { projectId: string }) {
  const attachFn = useServerFn(attachUserToProjectAdmin);
  const removeFn = useServerFn(removeProjectMemberAdmin);
  const updateRoleFn = useServerFn(updateProjectMemberRoleAdmin);

  const [members, setMembers] = useState<Member[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [scopes, setScopes] = useState<Scope[]>([]);
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<ProjectRoleValue>("usuario_comum");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: ms }, { data: ps }, { data: ars }, { data: scs }] = await Promise.all([
      supabase.from("project_members").select("id,user_id,role,profiles(id,nome,email)").eq("project_id", projectId),
      supabase.from("profiles").select("id,nome,email").order("nome"),
      supabase.from("project_areas").select("id,nome,parent_id").eq("project_id", projectId).order("display_order"),
      supabase.from("project_member_scopes").select("id,member_id,area_id"),
    ]);
    setMembers(((ms ?? []) as unknown as Array<{ id: string; user_id: string; role: ProjectRoleValue; profiles: Profile | null }>).map((m) => ({
      id: m.id, user_id: m.user_id, role: m.role, profile: m.profiles,
    })));
    setProfiles((ps ?? []) as Profile[]);
    setAreas((ars ?? []) as Area[]);
    setScopes((scs ?? []) as Scope[]);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  const vincular = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    try {
      await attachFn({ data: { projectId, userId, role } });
      setUserId("");
      toast.success("Usuário vinculado");
      void load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  };

  const alterarRole = async (m: Member, novo: ProjectRoleValue) => {
    try {
      await updateRoleFn({ data: { memberId: m.id, role: novo } });
      void load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  };

  const remover = async (m: Member) => {
    if (!confirm(`Remover ${m.profile?.nome ?? "membro"} deste projeto?`)) return;
    try {
      await removeFn({ data: { memberId: m.id } });
      void load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  };

  const addScope = async (member: Member, areaId: string) => {
    if (!areaId) return;
    const { error } = await supabase.from("project_member_scopes").insert({ member_id: member.id, area_id: areaId });
    if (error) return toast.error(error.message);
    void load();
  };

  const removeScope = async (scope: Scope) => {
    const { error } = await supabase.from("project_member_scopes").delete().eq("id", scope.id);
    if (error) return toast.error(error.message);
    void load();
  };

  const allAreas = areas; // includes setores (parent_id != null)

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">Permissões</p>
      <h1 className="mt-2 font-display text-4xl">Configurações</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Vincule usuários a este projeto e defina o perfil de acesso de cada um. Para Líderes de Setor, escolha o(s) setor(es) que eles gerenciam (a permissão inclui sub-setores).
      </p>

      <form onSubmit={vincular} className="mt-8 grid gap-3 rounded-xl border border-border bg-card p-5 md:grid-cols-[1fr_1fr_auto]">
        <select required value={userId} onChange={(e) => setUserId(e.target.value)} className={inp}>
          <option value="">— Selecione um usuário —</option>
          {profiles
            .filter((p) => !members.some((m) => m.user_id === p.id))
            .map((p) => <option key={p.id} value={p.id}>{p.nome} ({p.email})</option>)}
        </select>
        <select value={role} onChange={(e) => setRole(e.target.value as ProjectRoleValue)} className={inp}>
          {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </select>
        <button className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
          <Plus className="h-4 w-4" /> Adicionar
        </button>
      </form>

      <h2 className="mt-10 mb-3 font-display text-2xl">Membros</h2>
      {loading ? <p className="text-sm text-muted-foreground">Carregando...</p> : (
        <div className="space-y-3">
          {members.length === 0 && (
            <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Nenhum membro vinculado.
            </p>
          )}
          {members.map((m) => {
            const memberScopes = scopes.filter((s) => s.member_id === m.id);
            return (
              <div key={m.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-[200px] flex-1">
                    <p className="font-medium">{m.profile?.nome ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{m.profile?.email ?? ""}</p>
                  </div>
                  <select value={m.role} onChange={(e) => alterarRole(m, e.target.value as ProjectRoleValue)} className="rounded-md border border-border bg-background px-2 py-1 text-sm">
                    {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                    {!ROLE_OPTIONS.includes(m.role) && <option value={m.role}>{ROLE_LABELS[m.role] ?? m.role}</option>}
                  </select>
                  <button onClick={() => remover(m)} className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {m.role === "lider_setor" && (
                  <div className="mt-3 rounded-md border border-border bg-background/40 p-3">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Setores gerenciados</p>
                    {memberScopes.length === 0 && (
                      <p className="mb-2 text-xs text-muted-foreground">Nenhum setor vinculado ainda.</p>
                    )}
                    <div className="mb-2 flex flex-wrap gap-2">
                      {memberScopes.map((s) => {
                        const a = allAreas.find((x) => x.id === s.area_id);
                        return (
                          <span key={s.id} className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1 text-xs">
                            {a?.nome ?? "—"}
                            <button onClick={() => removeScope(s)} className="text-muted-foreground hover:text-destructive">×</button>
                          </span>
                        );
                      })}
                    </div>
                    <select
                      defaultValue=""
                      onChange={(e) => { addScope(m, e.target.value); e.currentTarget.value = ""; }}
                      className="rounded-md border border-border bg-background px-2 py-1 text-sm"
                    >
                      <option value="">+ Vincular setor...</option>
                      {allAreas
                        .filter((a) => !memberScopes.some((s) => s.area_id === a.id))
                        .map((a) => {
                          const parent = a.parent_id ? allAreas.find((x) => x.id === a.parent_id) : null;
                          return <option key={a.id} value={a.id}>{parent ? `${parent.nome} → ${a.nome}` : a.nome}</option>;
                        })}
                    </select>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
