import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Trash2, Library } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { logAction } from "@/lib/history";

export const Route = createFileRoute("/_authenticated/projetos/$projectId/modelos")({
  component: Modelos,
});

type Modelo = { id: string; nome: string; tipo: string; descricao: string | null; created_at: string };

function Modelos() {
  const { projectId } = Route.useParams();
  const { user } = useCurrentUser();
  const [rows, setRows] = useState<Modelo[]>([]);
  const [loading, setLoading] = useState(true);
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState("cargo");
  const [descricao, setDescricao] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("project_templates").select("id,nome,tipo,descricao,created_at").eq("project_id", projectId).order("created_at", { ascending: false });
    setRows((data as Modelo[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [projectId]);

  const adicionar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const { error } = await supabase.from("project_templates").insert({ project_id: projectId, created_by: user.id, nome, tipo, descricao: descricao || null });
    if (error) return toast.error(error.message);
    await logAction({ projectId, acao: "modelo_criado", entidade: "template", detalhes: { nome, tipo } });
    setNome(""); setDescricao("");
    toast.success("Modelo adicionado");
    load();
  };

  const remover = async (id: string) => {
    if (!confirm("Remover modelo?")) return;
    const { error } = await supabase.from("project_templates").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await logAction({ projectId, acao: "modelo_removido", entidade: "template", entidadeId: id });
    load();
  };

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Biblioteca</p>
        <h1 className="mt-2 font-display text-4xl">Modelos</h1>
        <p className="mt-1 text-sm text-muted-foreground">Templates, estruturas prontas e dados de referência do projeto.</p>
      </div>

      <form onSubmit={adicionar} className="mb-8 space-y-3 rounded-xl border border-border bg-card p-5">
        <div className="grid gap-3 md:grid-cols-[1fr_180px]">
          <input required placeholder="Nome do modelo" value={nome} onChange={(e) => setNome(e.target.value)} className={inp} />
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={inp}>
            <option value="cargo">Modelo de cargo</option>
            <option value="template">Template</option>
            <option value="estrutura">Estrutura</option>
            <option value="dados">Dados prontos</option>
          </select>
        </div>
        <textarea rows={2} placeholder="Descrição (opcional)" value={descricao} onChange={(e) => setDescricao(e.target.value)} className={inp} />
        <button className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"><Plus className="h-4 w-4" /> Adicionar</button>
      </form>

      {loading ? <p className="text-sm text-muted-foreground">Carregando...</p> :
       rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <Library className="mx-auto h-8 w-8 text-muted-foreground" strokeWidth={1.2} />
          <p className="mt-2 text-sm text-muted-foreground">Nenhum modelo na biblioteca</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((m) => (
            <div key={m.id} className="group rounded-xl border border-border bg-card p-5">
              <div className="flex items-start justify-between">
                <div>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs uppercase tracking-wider text-muted-foreground">{m.tipo}</span>
                  <h3 className="mt-2 font-display text-xl">{m.nome}</h3>
                  {m.descricao && <p className="mt-1 text-sm text-muted-foreground">{m.descricao}</p>}
                </div>
                <button onClick={() => remover(m.id)} className="opacity-0 transition group-hover:opacity-100 rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
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
