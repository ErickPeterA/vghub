import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";

export const Route = createFileRoute("/_authenticated/gerenciamento/atrelar")({
  component: AtrelarUsuarios,
});

type Member = { id: string; project_id: string; user_id: string; role: string; nome: string; email: string; projeto: string };

const roleOptions = [
  { v: "admin", l: "Admin" },
  { v: "lider_estrategico", l: "Líder Estratégico" },
  { v: "lider_tatico", l: "Líder Tático" },
  { v: "lider_operacional", l: "Líder Operacional" },
  { v: "gp", l: "GP (Gerente de Pessoas)" },
];

function AtrelarUsuarios() {
  const { isAdmin, loading: lu } = useCurrentUser();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Array<{ id: string; nome: string }>>([]);
  const [users, setUsers] = useState<Array<{ id: string; nome: string; email: string }>>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [projectId, setProjectId] = useState("");
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState("lider_operacional");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (!lu && !isAdmin) navigate({ to: "/projetos" }); }, [isAdmin, lu, navigate]);

  const load = async () => {
    const [{ data: ps }, { data: us }, { data: ms }] = await Promise.all([
      supabase.from("projects").select("id,nome").order("nome"),
      supabase.from("profiles").select("id,nome,email").order("nome"),
      supabase.from("project_members").select("id, project_id, user_id, role, projects(nome), profiles(nome,email)"),
    ]);
    setProjects(ps ?? []);
    setUsers(us ?? []);
    setMembers((ms ?? []).map((m) => ({
      id: m.id, project_id: m.project_id, user_id: m.user_id, role: m.role,
      // @ts-expect-error nested
      nome: m.profiles?.nome ?? "—", email: m.profiles?.email ?? "", projeto: m.projects?.nome ?? "—",
    })));
  };
  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  const vincular = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from("project_members").insert({ project_id: projectId, user_id: userId, role });
    if (error) { toast.error(error.message); setSaving(false); return; }
    await supabase.from("project_history").insert({
      project_id: projectId, user_id: (await supabase.auth.getUser()).data.user?.id, acao: "membro_adicionado", entidade: "member", detalhes: { user_id: userId, role },
    });
    toast.success("Usuário vinculado");
    setUserId(""); setSaving(false);
    load();
  };

  const remover = async (m: Member) => {
    if (!confirm(`Remover ${m.nome} de ${m.projeto}?`)) return;
    const { error } = await supabase.from("project_members").delete().eq("id", m.id);
    if (error) return toast.error(error.message);
    toast.success("Vínculo removido");
    load();
  };

  const alterarRole = async (id: string, novoRole: string) => {
    const { error } = await supabase.from("project_members").update({ role: novoRole }).eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="mb-8 font-display text-4xl">Atrelar Usuários</h1>

      <form onSubmit={vincular} className="mb-8 grid gap-3 rounded-xl border border-border bg-card p-5 md:grid-cols-[1fr_1fr_1fr_auto]">
        <select required value={projectId} onChange={(e) => setProjectId(e.target.value)} className={inp}>
          <option value="">— Projeto —</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
        <select required value={userId} onChange={(e) => setUserId(e.target.value)} className={inp}>
          <option value="">— Usuário —</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.nome} ({u.email})</option>)}
        </select>
        <select value={role} onChange={(e) => setRole(e.target.value)} className={inp}>
          {roleOptions.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}
        </select>
        <button disabled={saving} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"><Plus className="h-4 w-4" /> Vincular</button>
      </form>

      <h2 className="mb-3 font-display text-2xl">Vínculos existentes</h2>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-5 py-3 text-left">Projeto</th>
              <th className="px-5 py-3 text-left">Usuário</th>
              <th className="px-5 py-3 text-left">Cargo no projeto</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-t border-border/60">
                <td className="px-5 py-3 font-medium">{m.projeto}</td>
                <td className="px-5 py-3"><div>{m.nome}</div><div className="text-xs text-muted-foreground">{m.email}</div></td>
                <td className="px-5 py-3">
                  <select value={m.role} onChange={(e) => alterarRole(m.id, e.target.value)} className="rounded-md border border-border bg-background px-2 py-1 text-xs">
                    {roleOptions.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}
                  </select>
                </td>
                <td className="px-5 py-3 text-right">
                  <button onClick={() => remover(m)} className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
            {members.length === 0 && <tr><td colSpan={4} className="px-5 py-8 text-center text-sm text-muted-foreground">Nenhum vínculo</td></tr>}
          </tbody>
        </table>
      </div>
    </main>
  );
}

const inp = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";
