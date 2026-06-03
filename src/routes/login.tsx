import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Entrar — Estrutura DC" }] }),
  component: LoginPage,
});

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { session } = useCurrentUser();

  useEffect(() => {
    if (session) navigate({ to: "/projetos", replace: true });
  }, [session, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate({ to: "/projetos" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao autenticar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-accent" />
            <span className="font-display text-xl">Estrutura DC</span>
          </div>
          <h1 className="font-display text-4xl">Entrar</h1>
          <p className="mt-2 text-sm text-muted-foreground">Acesso restrito. Solicite credenciais ao administrador.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email" required placeholder="E-mail"
            value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-border bg-card px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            type="password" required placeholder="Senha"
            value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-border bg-card px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            disabled={loading}
            className="w-full rounded-lg bg-primary px-4 py-3 text-sm text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Aguarde..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
