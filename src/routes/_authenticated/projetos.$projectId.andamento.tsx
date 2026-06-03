import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, CheckCircle2, Circle, Clock } from "lucide-react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { logAction } from "@/lib/history";

export const Route = createFileRoute("/_authenticated/projetos/$projectId/andamento")({
  component: Andamento,
});

type Etapa = { id: string; etapa: string; status: string; percentual: number; ordem: number };

const STATUS_COLORS: Record<string, string> = {
  pendente: "#64748b",
  em_andamento: "#eab308",
  concluido: "#22c55e",
};

function Andamento() {
  const { projectId } = Route.useParams();
  const [rows, setRows] = useState<Etapa[]>([]);
  const [loading, setLoading] = useState(true);
  const [etapa, setEtapa] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("project_progress").select("*").eq("project_id", projectId).order("ordem");
    setRows((data as Etapa[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [projectId]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("project_progress").insert({ project_id: projectId, etapa, ordem: rows.length });
    if (error) return toast.error(error.message);
    await logAction({ projectId, acao: "etapa_criada", entidade: "progress", detalhes: { etapa } });
    setEtapa("");
    load();
  };

  const upd = async (id: string, patch: Partial<Etapa>) => {
    const { error } = await supabase.from("project_progress").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Remover etapa?")) return;
    await supabase.from("project_progress").delete().eq("id", id);
    load();
  };

  const total = rows.length;
  const concluidos = rows.filter((r) => r.status === "concluido").length;
  const emAndamento = rows.filter((r) => r.status === "em_andamento").length;
  const pendentes = rows.filter((r) => r.status === "pendente").length;
  const percentualGlobal = total === 0 ? 0 : Math.round(rows.reduce((a, b) => a + b.percentual, 0) / total);

  const pieData = [
    { name: "Concluído", value: concluidos, color: STATUS_COLORS.concluido },
    { name: "Em andamento", value: emAndamento, color: STATUS_COLORS.em_andamento },
    { name: "Pendente", value: pendentes, color: STATUS_COLORS.pendente },
  ].filter((d) => d.value > 0);

  const barData = rows.map((r) => ({ name: r.etapa, percentual: r.percentual }));

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Dashboard</p>
        <h1 className="mt-2 font-display text-4xl">Andamento do projeto</h1>
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-4">
        <KPI label="Progresso global" value={`${percentualGlobal}%`} icon={CheckCircle2} />
        <KPI label="Etapas totais" value={total.toString()} icon={Circle} />
        <KPI label="Em andamento" value={emAndamento.toString()} icon={Clock} />
        <KPI label="Concluídas" value={concluidos.toString()} icon={CheckCircle2} />
      </div>

      {rows.length > 0 && (
        <div className="mb-8 grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="mb-4 font-display text-lg">Percentual por etapa</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}>
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "currentColor" }} stroke="currentColor" opacity={0.5} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "currentColor" }} stroke="currentColor" opacity={0.5} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                  <Bar dataKey="percentual" fill="oklch(0.72 0.14 65)" radius={[6,6,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="mb-4 font-display text-lg">Status</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                    {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex justify-center gap-4 text-xs">
              {pieData.map((d) => <span key={d.name} className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: d.color }} /> {d.name}</span>)}
            </div>
          </div>
        </div>
      )}

      <form onSubmit={add} className="mb-6 flex gap-2 rounded-xl border border-border bg-card p-4">
        <input required placeholder="Nova etapa" value={etapa} onChange={(e) => setEtapa(e.target.value)} className={inp} />
        <button className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"><Plus className="h-4 w-4" /> Adicionar</button>
      </form>

      {loading ? <p className="text-sm text-muted-foreground">Carregando...</p> :
       rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">Adicione etapas para acompanhar o progresso</div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center gap-3">
                <input value={r.etapa} onChange={(e) => upd(r.id, { etapa: e.target.value })} className="flex-1 min-w-[160px] bg-transparent text-sm font-medium outline-none" />
                <select value={r.status} onChange={(e) => upd(r.id, { status: e.target.value })} className="rounded-md border border-border bg-background px-2 py-1 text-xs">
                  <option value="pendente">Pendente</option>
                  <option value="em_andamento">Em andamento</option>
                  <option value="concluido">Concluído</option>
                </select>
                <input type="range" min={0} max={100} value={r.percentual} onChange={(e) => upd(r.id, { percentual: Number(e.target.value) })} className="w-32" />
                <span className="w-10 text-right text-xs text-muted-foreground">{r.percentual}%</span>
                <button onClick={() => remove(r.id)} className="text-xs text-muted-foreground hover:text-destructive">Remover</button>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
                <div className="h-full transition-all" style={{ width: `${r.percentual}%`, background: STATUS_COLORS[r.status] }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

function KPI({ label, value, icon: Icon }: { label: string; value: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <Icon className="h-5 w-5 text-accent" />
      <p className="mt-3 text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-3xl">{value}</p>
    </div>
  );
}

const inp = "flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";
