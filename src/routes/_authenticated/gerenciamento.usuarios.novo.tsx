import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useCurrentUser } from "@/hooks/use-current-user";
import { createUserAdmin } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/gerenciamento/usuarios/novo")({
  component: NovoUsuario,
});

function NovoUsuario() {
  const { isAdmin, loading } = useCurrentUser();
  const navigate = useNavigate();
  const createFn = useServerFn(createUserAdmin);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [makeAdmin, setMakeAdmin] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !isAdmin) navigate({ to: "/projetos" });
  }, [isAdmin, loading, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createFn({ data: { nome, email, password, isAdmin: makeAdmin } });
      toast.success("Usuário criado");
      navigate({ to: "/gerenciamento/usuarios" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="mx-auto max-w-xl px-6 py-10">
      <h1 className="mb-8 font-display text-4xl">Criar Login</h1>
      <form onSubmit={submit} className="space-y-4 rounded-xl border border-border bg-card p-6">
        <Field label="Nome">
          <input required value={nome} onChange={(e) => setNome(e.target.value)} className={inp} />
        </Field>
        <Field label="E-mail">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inp}
          />
        </Field>
        <Field label="Senha">
          <input
            type="text"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inp}
          />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={makeAdmin}
            onChange={(e) => setMakeAdmin(e.target.checked)}
          />{" "}
          Conceder permissão de Administrador
        </label>
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={() => navigate({ to: "/gerenciamento/usuarios" })}
            className="rounded-md border border-border px-4 py-2 text-sm"
          >
            Cancelar
          </button>
          <button
            disabled={saving}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
          >
            {saving ? "Criando..." : "Criar Usuário"}
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
