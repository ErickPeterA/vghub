import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2, Users, Shield, UserPlus, Settings, Layers } from "lucide-react";
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
  lider_estrategico: "Líder Estratégico",
  lider_tatico: "Líder Tático",
  lider_operacional: "Líder Operacional",
  lider_superior: "Líder Superior (legado)",
  lider_setor: "Líder de Setor (legado)",
  usuario_comum: "Usuário Comum (legado)",
};
const ROLE_OPTIONS: ProjectRoleValue[] = ["admin", "gp", "lider_estrategico", "lider_tatico", "lider_operacional"];
const LIDER_ROLES = new Set(["lider_estrategico", "lider_tatico", "lider_operacional", "lider_superior", "lider_setor"]);

const inputClass = "w-full rounded-lg border border-[#042558]/20 bg-white/50 px-3 py-2.5 text-sm text-[#042558] outline-none transition-all focus:border-[#042558] focus:ring-2 focus:ring-[#042558]/20 placeholder:text-[#042558]/40";

export function ProjectConfigPage({ projectId }: { projectId: string }) {
  const attachFn = useServerFn(attachUserToProjectAdmin);
  const removeFn = useServerFn(removeProjectMemberAdmin);
  const updateRoleFn = useServerFn(updateProjectMemberRoleAdmin);

  const [members, setMembers] = useState<Member[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [scopes, setScopes] = useState<Scope[]>([]);
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<ProjectRoleValue>("lider_operacional");
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

  const allAreas = areas;

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#042558]/5 via-white to-[#042558]/5 px-6 py-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8 rounded-2xl border border-[#042558]/10 bg-white/80 p-6 shadow-sm backdrop-blur-sm">
          <div className="flex items-start gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#042558]">Configurações</h1>
              <p className="mt-1 max-w-2xl text-sm text-[#042558]/60">
                Vincule usuários a este projeto e defina o perfil de acesso de cada um.
              </p>
            </div>
          </div>
        </div>

        {/* Add Member Form */}
        <div className="mb-8 rounded-2xl border border-[#042558]/10 bg-white/60 p-6 shadow-sm backdrop-blur-sm transition-all hover:shadow-md">
          <div className="flex items-center gap-2 mb-4">
            <UserPlus className="h-4 w-4 text-[#042558]" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[#042558]">Adicionar membro</h2>
          </div>
          <form onSubmit={vincular} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <select required value={userId} onChange={(e) => setUserId(e.target.value)} className={inputClass}>
              <option value="">— Selecione um usuário —</option>
              {profiles
                .filter((p) => !members.some((m) => m.user_id === p.id))
                .map((p) => <option key={p.id} value={p.id}>{p.nome} ({p.email})</option>)}
            </select>
            <select value={role} onChange={(e) => setRole(e.target.value as ProjectRoleValue)} className={inputClass}>
              {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
            <button className="inline-flex items-center gap-2 rounded-lg bg-[#042558] px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-[#042558]/20 transition-all hover:bg-[#042558]/90 hover:shadow-xl hover:shadow-[#042558]/30">
              <Plus className="h-4 w-4" /> Adicionar
            </button>
          </form>
        </div>

        {/* Members List */}
        <div className="rounded-2xl border border-[#042558]/10 bg-white/60 p-6 shadow-sm backdrop-blur-sm transition-all hover:shadow-md">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-4 w-4 text-[#042558]" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[#042558]">
              Membros ({members.length})
            </h2>
          </div>

          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#042558] border-t-transparent" />
                <p className="text-sm text-[#042558]/60">Carregando membros...</p>
              </div>
            </div>
          ) : members.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#042558]/20 p-8">
              <Users className="mb-2 h-8 w-8 text-[#042558]/20" />
              <p className="text-sm font-medium text-[#042558]/40">Nenhum membro vinculado</p>
              <p className="text-xs text-[#042558]/30">Adicione membros ao projeto acima</p>
            </div>
          ) : (
            <div className="space-y-4">
              {members.map((m) => {
                const memberScopes = scopes.filter((s) => s.member_id === m.id);
                return (
                  <div key={m.id} className="overflow-hidden rounded-xl border border-[#042558]/10 bg-white/50 transition-all hover:border-[#042558]/30 hover:shadow-md">
                    <div className="flex flex-wrap items-center gap-4 p-4">
                      <div className="flex-1 min-w-[200px]">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#042558]/10 text-xs font-semibold text-[#042558]">
                            {m.profile?.nome?.charAt(0).toUpperCase() || "?"}
                          </div>
                          <div>
                            <p className="font-medium text-[#042558]">{m.profile?.nome ?? "—"}</p>
                            <p className="text-xs text-[#042558]/40">{m.profile?.email ?? ""}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-[#042558]/40" />
                        <select 
                          value={m.role} 
                          onChange={(e) => alterarRole(m, e.target.value as ProjectRoleValue)} 
                          className="rounded-lg border border-[#042558]/20 bg-white/50 px-3 py-1.5 text-sm text-[#042558] outline-none transition-all focus:border-[#042558] focus:ring-2 focus:ring-[#042558]/20"
                        >
                          {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                          {!ROLE_OPTIONS.includes(m.role) && <option value={m.role}>{ROLE_LABELS[m.role] ?? m.role}</option>}
                        </select>
                      </div>
                      <button 
                        onClick={() => remover(m)} 
                        className="rounded-lg p-2 text-[#042558]/40 transition-colors hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    {LIDER_ROLES.has(m.role) && (
                      <div className="border-t border-[#042558]/10 bg-[#042558]/5 p-4">
                        <div className="space-y-4">
                          <ScopePicker
                            title="Áreas"
                            subtitle="Obrigatório: escolha ao menos uma área que este líder gerencia."
                            options={allAreas.filter((a) => a.parent_id === null)}
                            memberScopes={memberScopes}
                            onAdd={(id) => addScope(m, id)}
                            onRemove={removeScope}
                          />
                          <ScopePicker
                            title="Setores"
                            subtitle="Opcional: setores específicos (pode escolher mais de um)."
                            options={allAreas.filter((a) => a.parent_id !== null)}
                            memberScopes={memberScopes}
                            onAdd={(id) => addScope(m, id)}
                            onRemove={removeScope}
                            renderLabel={(a) => {
                              const parent = a.parent_id ? allAreas.find((x) => x.id === a.parent_id) : null;
                              return parent ? `${parent.nome} → ${a.nome}` : a.nome;
                            }}
                          />
                          {memberScopes.filter((s) => {
                            const a = allAreas.find((x) => x.id === s.area_id);
                            return a && a.parent_id === null;
                          }).length === 0 && (
                            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                              ⚠ Este líder ainda não tem nenhuma área vinculada.
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function ScopePicker({
  title, subtitle, options, memberScopes, onAdd, onRemove, renderLabel,
}: {
  title: string;
  subtitle: string;
  options: Area[];
  memberScopes: Scope[];
  onAdd: (areaId: string) => void;
  onRemove: (scope: Scope) => void;
  renderLabel?: (a: Area) => string;
}) {
  const optionIds = new Set(options.map((o) => o.id));
  const selected = memberScopes.filter((s) => optionIds.has(s.area_id));
  const label = (a: Area) => (renderLabel ? renderLabel(a) : a.nome);
  
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-[#042558]/50">{title}</p>
      <p className="mb-2 text-[11px] text-[#042558]/40">{subtitle}</p>
      {selected.length === 0 && (
        <p className="mb-2 text-xs italic text-[#042558]/40">Nenhum item vinculado.</p>
      )}
      <div className="mb-2 flex flex-wrap gap-2">
        {selected.map((s) => {
          const a = options.find((x) => x.id === s.area_id);
          if (!a) return null;
          return (
            <span key={s.id} className="inline-flex items-center gap-2 rounded-full border border-[#042558]/20 bg-white/60 px-3 py-1 text-xs font-medium text-[#042558]">
              {label(a)}
              <button 
                onClick={() => onRemove(s)} 
                className="text-[#042558]/40 transition-colors hover:text-red-600"
              >
                ×
              </button>
            </span>
          );
        })}
      </div>
      <select
        defaultValue=""
        onChange={(e) => { onAdd(e.target.value); e.currentTarget.value = ""; }}
        className="rounded-lg border border-[#042558]/20 bg-white/50 px-3 py-2 text-sm text-[#042558] outline-none transition-all focus:border-[#042558] focus:ring-2 focus:ring-[#042558]/20"
      >
        <option value="">+ Vincular {title.toLowerCase()}...</option>
        {options
          .filter((a) => !memberScopes.some((s) => s.area_id === a.id))
          .map((a) => <option key={a.id} value={a.id}>{label(a)}</option>)}
      </select>
    </div>
  );
}