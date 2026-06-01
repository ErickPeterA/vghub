import { createFileRoute, Outlet, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { LogOut, Plus, LayoutGrid } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  component: AuthLayout,
});

function AuthLayout() {
  const { session, loading, user } = useAuth();
  const navigate = useNavigate();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login", replace: true });
  }, [loading, session, navigate]);

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-10 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-8">
            <Link to="/dashboard" className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-accent" />
              <span className="font-display text-xl">Estrutura DC</span>
            </Link>
            <Link
              to="/dashboard"
              activeProps={{ className: "text-foreground" }}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <LayoutGrid className="h-4 w-4" /> Cargos
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/cargos/novo"
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90"
            >
              <Plus className="h-4 w-4" /> Novo cargo
            </Link>
            <span className="hidden text-xs text-muted-foreground md:inline">{user?.email}</span>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                router.invalidate();
                navigate({ to: "/login" });
              }}
              className="rounded-full border border-border p-2 text-muted-foreground hover:bg-secondary"
              title="Sair"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </nav>
      <Outlet />
    </div>
  );
}
