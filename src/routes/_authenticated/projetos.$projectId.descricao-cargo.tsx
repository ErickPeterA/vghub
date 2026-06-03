import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, FileText } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { logAction } from "@/lib/history";

export const Route = createFileRoute("/_authenticated/projetos/$projectId/descricao-cargo")({
  component: DCList,
});

type Row = { id: string; cargo: string; departamento: string | null; nivelamento: string | null; status: string; updated_at: string };

function DCList() {
  const { projectId } = Route.useParams();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("descricoes_cargo").select("id,cargo,departamento,nivelamento,status,updated_at")
      .eq("project_id", projectId).order("updated_at", { ascending: false });
    if (error) toast.error(error.message);
    setRows((data as Row[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [projectId]);

  const remove = async (id: string, cargo: string) => {
    if (!confirm("Excluir descrição?")) return;
    const { error } = await supabase.from("descricoes_cargo").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await logAction({ projectId, acao: "dc_excluida", entidade: "descricao_cargo", entidadeId: id, detalhes: { cargo } });
    toast.success("Excluída");
    load();
  };

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Cargos do projeto</p>
          <h1 className="mt-2 font-display text-4xl">Descrição de Cargo</h1>
        </div>
        <Link to="/projetos/$projectId/descricao-cargo/novo" params={{ projectId }} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground">
          <Plus className="h-4 w-4" /> Novo cargo
        </Link>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Carregando...</p> :
       rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
          <FileText className="mx-auto h-8 w-8 text-muted-foreground" strokeWidth={1.2} />
          <p className="mt-2 text-sm text-muted-foreground">Nenhuma descrição cadastrada</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3 text-left">Cargo</th>
                <th className="px-5 py-3 text-left">Departamento</th>
                <th className="px-5 py-3 text-left">Nível</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-left">Atualizado</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border/60 hover:bg-secondary/30">
                  <td className="px-5 py-3 font-medium">{r.cargo}</td>
                  <td className="px-5 py-3 text-muted-foreground">{r.departamento || "—"}</td>
                  <td className="px-5 py-3 text-muted-foreground">{r.nivelamento || "—"}</td>
                  <td className="px-5 py-3"><span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{r.status}</span></td>
                  <td className="px-5 py-3 text-muted-foreground">{new Date(r.updated_at).toLocaleDateString("pt-BR")}</td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-1">
                      <Link to="/projetos/$projectId/descricao-cargo/$dcId" params={{ projectId, dcId: r.id }} className="rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"><Pencil className="h-4 w-4" /></Link>
                      <button onClick={() => remove(r.id, r.cargo)} className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
