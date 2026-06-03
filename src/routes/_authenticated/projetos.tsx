import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, FolderKanban, Archive } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";

export const Route = createFileRoute("/_authenticated/projetos")({
  component: ProjetosList,
});

type Projeto = {
  id: string;
  nome: string;
  empresa: string | null;
  status: string;
  responsavel_id: string | null;
  created_at: string;
};

function ProjetosList() {
  const { isAdmin } = useCurrentUser();
  const [rows, setRows] = useState<Projeto[]>([]);
  const [loading, setLoading] = useState(true);
  const [responsaveis, setResponsaveis] = useState<Record<string, string>>({});
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("projects")
      .select("id, nome, empresa, status, responsavel_id, created_at")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    const projs = (data as Projeto[]) ?? [];
    setRows(projs);
    const ids = Array.from(new Set(projs.map((p) => p.responsavel_id).filter(Boolean))) as string[];
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id,nome").in("id", ids);
      const map: Record<string, string> = {};
      (profs ?? []).forEach((p) => { map[p.id] = p.nome; });
      setResponsaveis(map);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const arquivar = async (id: string, atual: string) => {
    const novo = atual === "arquivado" ? "ativo" : "arquivado";
    const { error } = await supabase.from("projects").update({ status: novo }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(novo === "arquivado" ? "Projeto arquivado" : "Projeto reativado");
    load();
  };

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <div className="mb-10 flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Workspace</p>
          <h1 className="mt-2 font-display text-5xl">Projetos</h1>
        </div>
        {isAdmin && (
          <Link to="/projetos/novo" className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90">
            <Plus className="h-4 w-4" /> Novo projeto
          </Link>
        )}
      </div>

      {loading ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center text-sm text-muted-foreground">Carregando...</div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-16 text-center">
          <FolderKanban className="mx-auto h-10 w-10 text-muted-foreground" strokeWidth={1.2} />
          <h3 className="mt-4 font-display text-2xl">Nenhum projeto disponível</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {isAdmin ? "Crie o primeiro projeto." : "Você ainda não está vinculado a nenhum projeto. Fale com o administrador."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {rows.map((p) => (
            <div key={p.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-2">
                <Link to="/projetos/$projectId/central" params={{ projectId: p.id }} className="flex-1">
                  <h3 className="font-display text-xl leading-tight hover:text-accent">{p.nome}</h3>
                  {p.empresa && <p className="mt-1 text-sm text-muted-foreground">{p.empresa}</p>}
                </Link>
                <span className={`rounded-full px-2 py-0.5 text-xs ${p.status === "ativo" ? "bg-accent/20 text-accent" : "bg-muted text-muted-foreground"}`}>
                  {p.status}
                </span>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                <span>{p.responsavel_id ? responsaveis[p.responsavel_id] ?? "—" : "Sem responsável"}</span>
                <span>{new Date(p.created_at).toLocaleDateString("pt-BR")}</span>
              </div>
              {isAdmin && (
                <div className="mt-4 flex gap-2 border-t border-border pt-3">
                  <button onClick={() => navigate({ to: "/projetos/$projectId/central", params: { projectId: p.id } })} className="flex-1 rounded-md bg-secondary px-3 py-1.5 text-xs hover:bg-secondary/80">Abrir</button>
                  <button onClick={() => arquivar(p.id, p.status)} className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
                    <Archive className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
