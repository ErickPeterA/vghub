import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useCurrentUser } from "@/hooks/use-current-user";
import { apiJson } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/projetos/novo")({
  component: NovoProjeto,
});

type AssignableUser = {
  id: string;
  nome: string;
  email: string;
};

function NovoProjeto() {
  const { isAdmin, loading } = useCurrentUser();
  const navigate = useNavigate();
  const [nome, setNome] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [responsavelId, setResponsavelId] = useState("");
  const [users, setUsers] = useState<AssignableUser[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !isAdmin) {
      toast.error("Acesso restrito");
      navigate({ to: "/projetos" });
    }
  }, [isAdmin, loading, navigate]);

  useEffect(() => {
    if (loading || !isAdmin) return;

    apiJson<{ ok: boolean; users: AssignableUser[] }>("/api/users")
      .then((payload) => setUsers(payload.users ?? []))
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : "Erro ao carregar usuarios");
      });
  }, [isAdmin, loading]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = await apiJson<{ ok: boolean; project: { id: string } }>("/api/projects", {
        method: "POST",
        body: { nome, empresa, responsavelId },
      });
      toast.success("Projeto criado");
      navigate({ to: "/projetos/$projectId/areas", params: { projectId: payload.project.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar projeto");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="mb-8 font-display text-4xl">Novo projeto</h1>
      <form onSubmit={submit} className="space-y-4 rounded-xl border border-border bg-card p-6">
        <Field label="Nome do projeto">
          <input required value={nome} onChange={(e) => setNome(e.target.value)} className={inp} />
        </Field>
        <Field label="Empresa">
          <input value={empresa} onChange={(e) => setEmpresa(e.target.value)} className={inp} />
        </Field>
        <Field label="Responsavel">
          <select
            value={responsavelId}
            onChange={(e) => setResponsavelId(e.target.value)}
            className={inp}
          >
            <option value="">-- sem responsavel --</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
          </select>
        </Field>
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={() => navigate({ to: "/projetos" })}
            className="rounded-md border border-border px-4 py-2 text-sm"
          >
            Cancelar
          </button>
          <button
            disabled={saving}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Criar projeto"}
          </button>
        </div>
      </form>
    </main>
  );
}

const inp =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
