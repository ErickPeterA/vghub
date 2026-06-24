import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Pencil, Trash2, UserPlus, Power } from "lucide-react";
import { toast } from "sonner";
import { useCurrentUser } from "@/hooks/use-current-user";
import { listUsersAdmin, updateUserAdmin, deleteUserAdmin } from "@/lib/admin.functions";
import { withTimeout } from "@/lib/auth-safe";

export const Route = createFileRoute("/_authenticated/gerenciamento/usuarios/")({
  component: GerenciarUsuarios,
});

type Row = { id: string; nome: string; email: string; status: string; isAdmin: boolean; created_at: string };

function GerenciarUsuarios() {
  const { isAdmin, loading: lu } = useCurrentUser();
  const navigate = useNavigate();
  const listFn = useServerFn(listUsersAdmin);
  const updFn = useServerFn(updateUserAdmin);
  const delFn = useServerFn(deleteUserAdmin);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Row | null>(null);

  useEffect(() => { if (!lu && !isAdmin) void navigate({ to: "/projetos" }); }, [isAdmin, lu, navigate]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await withTimeout(listFn(), 10_000, "Não foi possível carregar usuários.");
      setRows(data as Row[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar");
      setRows([]);
    } finally { setLoading(false); }
  };
  useEffect(() => { if (isAdmin) void load(); }, [isAdmin]);

  const toggleStatus = async (r: Row) => {
    try {
      await updFn({ data: { userId: r.id, status: r.status === "ativo" ? "inativo" : "ativo" } });
      toast.success("Status atualizado");
      void load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  };

  const excluir = async (r: Row) => {
    if (!confirm(`Excluir ${r.nome}?`)) return;
    try {
      await delFn({ data: { userId: r.id } });
      toast.success("Usuário excluído");
      void load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  };

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Gerenciamento</p>
          <h1 className="mt-2 font-display text-4xl">Usuários</h1>
        </div>
        <Link to="/gerenciamento/usuarios/novo" className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground">
          <UserPlus className="h-4 w-4" /> Criar usuário
        </Link>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Carregando...</p> : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3 text-left">Nome</th>
                <th className="px-5 py-3 text-left">E-mail</th>
                <th className="px-5 py-3 text-left">Papel</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border/60 hover:bg-secondary/30">
                  <td className="px-5 py-3 font-medium">{r.nome}</td>
                  <td className="px-5 py-3 text-muted-foreground">{r.email}</td>
                  <td className="px-5 py-3"><span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{r.isAdmin ? "Admin" : "Usuário"}</span></td>
                  <td className="px-5 py-3"><span className={`rounded-full px-2 py-0.5 text-xs ${r.status === "ativo" ? "bg-accent/20 text-accent" : "bg-muted text-muted-foreground"}`}>{r.status}</span></td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => setEditing(r)} className="rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => toggleStatus(r)} className="rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground" title="Ativar/Desativar"><Power className="h-4 w-4" /></button>
                      <button onClick={() => excluir(r)} className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && <EditDialog row={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void load(); }} />}
    </main>
  );
}

function EditDialog({ row, onClose, onSaved }: { row: Row; onClose: () => void; onSaved: () => void }) {
  const updFn = useServerFn(updateUserAdmin);
  const [nome, setNome] = useState(row.nome);
  const [email, setEmail] = useState(row.email);
  const [password, setPassword] = useState("");
  const [isAdmin, setIsAdmin] = useState(row.isAdmin);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updFn({ data: { userId: row.id, nome, email, isAdmin, ...(password ? { password } : {}) } });
      toast.success("Atualizado");
      onSaved();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 font-display text-2xl">Editar usuário</h2>
        <form onSubmit={submit} className="space-y-3">
          <input className={inp} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome" required />
          <input type="email" className={inp} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail" required />
          <input type="password" className={inp} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Nova senha (deixe em branco para manter)" />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} /> Administrador</label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm">Cancelar</button>
            <button disabled={saving} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">{saving ? "Salvando..." : "Salvar"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inp = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";