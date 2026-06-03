import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Trash2, FileText } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { logAction } from "@/lib/history";

export const Route = createFileRoute("/_authenticated/projetos/$projectId/central")({
  component: PaginaCentral,
});

type Nota = { id: string; titulo: string; conteudo: string | null; secao: string; created_at: string };

function PaginaCentral() {
  const { projectId } = Route.useParams();
  const { user } = useCurrentUser();
  const [notas, setNotas] = useState<Nota[]>([]);
  const [loading, setLoading] = useState(true);
  const [titulo, setTitulo] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [secao, setSecao] = useState("nota");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("project_hub").select("id,titulo,conteudo,secao,created_at").eq("project_id", projectId).order("created_at", { ascending: false });
    setNotas((data as Nota[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [projectId]);

  const adicionar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const { error } = await supabase.from("project_hub").insert({ project_id: projectId, created_by: user.id, titulo, conteudo: conteudo || null, secao });
    if (error) return toast.error(error.message);
    await logAction({ projectId, acao: "hub_item_criado", entidade: "hub", detalhes: { titulo, secao } });
    setTitulo(""); setConteudo(""); toast.success("Adicionado");
    load();
  };

  const remover = async (id: string) => {
    if (!confirm("Remover?")) return;
    const { error } = await supabase.from("project_hub").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await logAction({ projectId, acao: "hub_item_removido", entidade: "hub", entidadeId: id });
    load();
  };

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Hub de informações</p>
        <h1 className="mt-2 font-display text-4xl">Página Central</h1>
        <p className="mt-1 text-sm text-muted-foreground">Resumos, observações, dados estratégicos e anotações do projeto.</p>
      </div>

      <form onSubmit={adicionar} className="mb-8 space-y-3 rounded-xl border border-border bg-card p-5">
        <div className="grid gap-3 md:grid-cols-[1fr_180px]">
          <input required placeholder="Título" value={titulo} onChange={(e) => setTitulo(e.target.value)} className={inp} />
          <select value={secao} onChange={(e) => setSecao(e.target.value)} className={inp}>
            <option value="nota">Anotação</option>
            <option value="resumo">Resumo</option>
            <option value="estrategico">Estratégico</option>
            <option value="observacao">Observação</option>
            <option value="dado">Dado</option>
          </select>
        </div>
        <textarea placeholder="Conteúdo (opcional)" value={conteudo} onChange={(e) => setConteudo(e.target.value)} rows={3} className={inp} />
        <button className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
          <Plus className="h-4 w-4" /> Adicionar
        </button>
      </form>

      {loading ? <p className="text-sm text-muted-foreground">Carregando...</p> :
       notas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <FileText className="mx-auto h-8 w-8 text-muted-foreground" strokeWidth={1.2} />
          <p className="mt-2 text-sm text-muted-foreground">Nenhum item ainda</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notas.map((n) => (
            <div key={n.id} className="group rounded-xl border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs uppercase tracking-wider text-muted-foreground">{n.secao}</span>
                  <h3 className="mt-2 font-display text-xl">{n.titulo}</h3>
                  {n.conteudo && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{n.conteudo}</p>}
                  <p className="mt-3 text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString("pt-BR")}</p>
                </div>
                <button onClick={() => remover(n.id)} className="opacity-0 transition group-hover:opacity-100 rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

const inp = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";
