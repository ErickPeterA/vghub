import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Pencil, Trash2, FileText } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

type Row = {
  id: string;
  cargo: string;
  departamento: string | null;
  nivelamento: string | null;
  status: string;
  updated_at: string;
};

function Dashboard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("descricoes_cargo")
      .select("id, cargo, departamento, nivelamento, status, updated_at")
      .order("updated_at", { ascending: false });
    if (error) toast.error(error.message);
    setRows((data as Row[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const remove = async (id: string) => {
    if (!confirm("Excluir esta descrição?")) return;
    const { error } = await supabase.from("descricoes_cargo").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Descrição excluída");
    load();
  };

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <div className="mb-10 flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Base de dados</p>
          <h1 className="mt-2 font-display text-5xl">Descrições de cargo</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {loading ? "..." : `${rows.length} registro${rows.length === 1 ? "" : "s"}`}
        </p>
      </div>

      {loading ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center text-sm text-muted-foreground">
          Carregando...
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-16 text-center">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground" strokeWidth={1.2} />
          <h3 className="mt-4 font-display text-2xl">Nenhuma descrição ainda</h3>
          <p className="mt-2 text-sm text-muted-foreground">Comece cadastrando seu primeiro cargo.</p>
          <Link to="/cargos/novo" className="mt-6 inline-block rounded-full bg-primary px-5 py-2.5 text-sm text-primary-foreground">
            Cadastrar cargo
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3 text-left font-medium">Cargo</th>
                <th className="px-5 py-3 text-left font-medium">Departamento</th>
                <th className="px-5 py-3 text-left font-medium">Nível</th>
                <th className="px-5 py-3 text-left font-medium">Status</th>
                <th className="px-5 py-3 text-left font-medium">Atualizado</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border/60 hover:bg-secondary/30">
                  <td className="px-5 py-3 font-medium">{r.cargo}</td>
                  <td className="px-5 py-3 text-muted-foreground">{r.departamento || "—"}</td>
                  <td className="px-5 py-3 text-muted-foreground">{r.nivelamento || "—"}</td>
                  <td className="px-5 py-3">
                    <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs">{r.status}</span>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {new Date(r.updated_at).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-1">
                      <Link
                        to="/cargos/$id"
                        params={{ id: r.id }}
                        className="rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
                      >
                        <Pencil className="h-4 w-4" />
                      </Link>
                      <button
                        onClick={() => remove(r.id)}
                        className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
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
