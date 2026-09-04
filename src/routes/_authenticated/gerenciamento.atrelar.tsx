import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiJson } from "@/lib/api";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  attachUserToProjectAdmin,
  removeProjectMemberAdmin,
  updateProjectMemberRoleAdmin,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/gerenciamento/atrelar")({
  component: AtrelarUsuarios,
});

type Member = {
  id: string;
  project_id: string;
  user_id: string;
  role: string;
  nome: string;
  email: string;
  projeto: string;
};

const roleOptions = [
  { v: "admin", l: "Admin" },
  { v: "gp", l: "GP (Gerente de Pessoas)" },
  { v: "lider_estrategico", l: "Líder Estratégico" },
  { v: "lider_tatico", l: "Líder Tático" },
  { v: "lider_operacional", l: "Líder Operacional" },
];
type RoleValue =
  | "admin"
  | "gp"
  | "lider_estrategico"
  | "lider_tatico"
  | "lider_operacional"
  | "lider_superior"
  | "lider_setor"
  | "usuario_comum";

function AtrelarUsuarios() {
  const { isAdmin, loading: lu } = useCurrentUser();
  const navigate = useNavigate();
  const attachFn = useServerFn(attachUserToProjectAdmin);
  const removeFn = useServerFn(removeProjectMemberAdmin);
  const updateRoleFn = useServerFn(updateProjectMemberRoleAdmin);
  const [projects, setProjects] = useState<Array<{ id: string; nome: string }>>([]);
  const [users, setUsers] = useState<Array<{ id: string; nome: string; email: string }>>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [projectId, setProjectId] = useState("");
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<RoleValue>("lider_operacional");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!lu && !isAdmin) navigate({ to: "/projetos" });
  }, [isAdmin, lu, navigate]);

  const load = async () => {
    const data = await apiJson<{
      ok: boolean;
      projects: Array<{ id: string; nome: string }>;
      users: Array<{ id: string; nome: string; email: string }>;
      members: unknown[];
    }>("/api/project-members");
    const ps = data.projects;
    const us = data.users;
    const ms = data.members;
    setProjects(ps ?? []);
    setUsers(us ?? []);
    setMembers(
      (ms ?? []).map((m) => {
        const row = m as unknown as {
          id: string;
          project_id: string;
          user_id: string;
          role: string;
          profiles: { nome?: string; email?: string } | null;
          projects: { nome?: string } | null;
        };
        return {
          id: row.id,
          project_id: row.project_id,
          user_id: row.user_id,
          role: row.role,
          nome: row.profiles?.nome ?? "—",
          email: row.profiles?.email ?? "",
          projeto: row.projects?.nome ?? "—",
        };
      }),
    );
  };
  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin]);

  const vincular = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await attachFn({ data: { projectId, userId, role } });
      toast.success("Usuário vinculado");
      setUserId("");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao vincular");
    } finally {
      setSaving(false);
    }
  };

  const remover = async (m: Member) => {
    if (!confirm(`Remover ${m.nome} de ${m.projeto}?`)) return;
    try {
      await removeFn({ data: { memberId: m.id } });
      toast.success("Vínculo removido");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao remover");
    }
  };

  const alterarRole = async (id: string, novoRole: string) => {
    try {
      await updateRoleFn({ data: { memberId: id, role: novoRole as RoleValue } });
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao alterar cargo");
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="mb-8 font-display text-4xl">Atrelar Usuários</h1>

      <form
        onSubmit={vincular}
        className="mb-8 grid gap-3 rounded-xl border border-border bg-card p-5 md:grid-cols-[1fr_1fr_1fr_auto]"
      >
        <select
          required
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className={inp}
        >
          <option value="">— Projeto —</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
        <select required value={userId} onChange={(e) => setUserId(e.target.value)} className={inp}>
          <option value="">— Usuário —</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nome} ({u.email})
            </option>
          ))}
        </select>
        <select value={role} onChange={(e) => setRole(e.target.value as RoleValue)} className={inp}>
          {roleOptions.map((r) => (
            <option key={r.v} value={r.v}>
              {r.l}
            </option>
          ))}
        </select>
        <button
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Vincular
        </button>
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
                <td className="px-5 py-3">
                  <div>{m.nome}</div>
                  <div className="text-xs text-muted-foreground">{m.email}</div>
                </td>
                <td className="px-5 py-3">
                  <select
                    value={m.role}
                    onChange={(e) => alterarRole(m.id, e.target.value)}
                    className="rounded-md border border-border bg-background px-2 py-1 text-xs"
                  >
                    {roleOptions.map((r) => (
                      <option key={r.v} value={r.v}>
                        {r.l}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-5 py-3 text-right">
                  <button
                    onClick={() => remover(m)}
                    className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {members.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-sm text-muted-foreground">
                  Nenhum vínculo
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}

const inp =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";
