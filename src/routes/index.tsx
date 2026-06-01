import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Estrutura DC — Base de Descrições de Cargo" },
      { name: "description", content: "Cadastre e organize descrições de cargo em uma base estruturada." },
    ],
  }),
  component: Index,
});

function Index() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && session) navigate({ to: "/dashboard", replace: true });
  }, [loading, session, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-accent" />
            <span className="font-display text-xl">Estrutura DC</span>
          </div>
          <Link to="/login" className="rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground">
            Entrar
          </Link>
        </div>
      </nav>
      <main className="mx-auto max-w-6xl px-6 py-32">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Base de dados</p>
        <h1 className="mt-4 font-display text-6xl leading-[1.05] md:text-7xl">
          Cadastre, organize <br />e mantenha viva sua <em className="text-accent">base de cargos</em>.
        </h1>
        <p className="mt-8 max-w-xl text-lg text-muted-foreground">
          Um formulário estruturado em oito blocos — cabeçalho, instrução,
          experiência, conhecimento, atividades, indicadores, habilidades e
          postura — salvo direto no banco.
        </p>
        <Link
          to="/login"
          className="mt-10 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm text-primary-foreground transition hover:opacity-90"
        >
          Começar a cadastrar <ArrowRight className="h-4 w-4" />
        </Link>
      </main>
    </div>
  );
}
