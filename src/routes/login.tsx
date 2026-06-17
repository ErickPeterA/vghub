import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Lock, Mail, LogIn, Building2 } from "lucide-react";

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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#042558] via-[#0a3a7a] to-[#1a5a9a] px-4">
      <div className="w-full max-w-md">
        {/* Card centralizado */}
        <div className="rounded-xl bg-white/95 backdrop-blur-sm p-8 shadow-2xl shadow-black/20">
          {/* Header */}
          <div className="mb-4 text-center">
            <img src="/logobg.png" alt="Logo" className="mx-auto  w-40 " />
            <h1 className="text-3xl font-bold text-[#042558] tracking-tight pt-4 pb-3">
              Entrar
            </h1>
            <p className="text-sm text-gray-500">
              Acesso restrito. Solicite credenciais ao administrador.
            </p>
          </div>

          {/* Formulário */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="email"
                required
                placeholder="E-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-10 py-2.5 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-[#042558] focus:bg-white focus:ring-2 focus:ring-[#042558]/20"
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="password"
                required
                placeholder="Senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-10 py-2.5 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-[#042558] focus:bg-white focus:ring-2 focus:ring-[#042558]/20"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-[#042558] px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-[#042558]/90 hover:shadow-lg hover:shadow-[#042558]/20 disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Aguarde...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <LogIn className="h-4 w-4" />
                  Entrar
                </span>
              )}
            </button>
          </form>

          {/* Rodapé */}
          <div className="mt-6 border-t border-gray-100 pt-4 text-center">
          </div>
        </div>
      </div>
    </div>
  );
}