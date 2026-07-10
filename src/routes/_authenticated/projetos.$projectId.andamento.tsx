import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, FileText, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/projetos/$projectId/andamento")({
  component: Andamento,
});

type Stage = "em_criacao" | "em_aprovacao" | "concluido";
type DcRow = {
  id: string;
  cargo: string | null;
  etapa: Stage;
  created_at: string;
};

const STAGES: Array<{
  key: Stage;
  label: string;
  description: string;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    key: "em_criacao",
    label: "Em criação",
    description: "descrições ainda sendo montadas",
    color: "#2563eb",
    icon: Clock3,
  },
  {
    key: "em_aprovacao",
    label: "Em aprovação",
    description: "descrições aguardando validação",
    color: "#d97706",
    icon: Send,
  },
  {
    key: "concluido",
    label: "Concluídos",
    description: "descrições finalizadas",
    color: "#16a34a",
    icon: CheckCircle2,
  },
];

function Andamento() {
  const { projectId } = Route.useParams();
  const [rows, setRows] = useState<DcRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("descricoes_cargo")
        .select("id,cargo,etapa,created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (!active) return;
      if (error) {
        toast.error(error.message);
        setRows([]);
      } else {
        setRows((data as DcRow[]) ?? []);
      }
      setLoading(false);
    };

    void load();

    return () => {
      active = false;
    };
  }, [projectId]);

  const stats = useMemo(() => {
    const counts = STAGES.reduce(
      (acc, stage) => ({ ...acc, [stage.key]: 0 }),
      {} as Record<Stage, number>,
    );

    rows.forEach((row) => {
      counts[row.etapa] += 1;
    });

    const total = rows.length;
    const done = counts.concluido;
    const approval = counts.em_aprovacao;
    const progress = total === 0 ? 0 : Math.round(((done + approval * 0.55) / total) * 100);

    const waveData = STAGES.map((stage) => ({
      stage: stage.label,
      key: stage.key,
      quantidade: counts[stage.key],
      percentual: total === 0 ? 0 : Math.round((counts[stage.key] / total) * 100),
      color: stage.color,
    }));

    return { counts, total, progress, waveData };
  }, [rows]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#042558]/5 via-white to-[#f59e0b]/5 px-6 py-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 rounded-2xl border border-[#042558]/10 bg-white/85 p-6 shadow-sm backdrop-blur-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#042558]/50">Dashboard</p>
          <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-[#042558]">Andamento do projeto</h1>
              <p className="mt-1 max-w-2xl text-sm text-[#042558]/60">
                A onda mostra quantas descrições estão em criação, em aprovação e concluídas.
              </p>
            </div>
            <div className="rounded-xl border border-[#042558]/10 bg-[#042558] px-5 py-3 text-white shadow-lg shadow-[#042558]/15">
              <p className="text-xs uppercase tracking-wider text-white/65">Progresso estimado</p>
              <p className="text-3xl font-bold">{stats.progress}%</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex h-72 items-center justify-center rounded-2xl border border-[#042558]/10 bg-white/75">
            <Loader2 className="h-7 w-7 animate-spin text-[#042558]" />
          </div>
        ) : stats.total === 0 ? (
          <div className="flex h-72 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#042558]/20 bg-white/75 text-center">
            <FileText className="mb-3 h-9 w-9 text-[#042558]/30" />
            <h2 className="text-lg font-semibold text-[#042558]">Sem descrições para acompanhar</h2>
            <p className="mt-1 text-sm text-[#042558]/55">
              Quando houver descrições de cargo no projeto, a onda aparece aqui.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <section className="rounded-2xl border border-[#042558]/10 bg-white p-6 shadow-sm">
              <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-[#042558]">Onda de andamento</h2>
                  <p className="text-sm text-[#042558]/55">Baseada no estágio atual das descrições de cargo.</p>
                </div>
                <span className="text-sm font-medium text-[#042558]/70">{stats.total} descrições no total</span>
              </div>

              <div className="h-[360px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.waveData} margin={{ top: 18, right: 18, left: 0, bottom: 8 }}>
                    <defs>
                      <linearGradient id="andamentoWave" x1="0" x2="1" y1="0" y2="0">
                        <stop offset="0%" stopColor="#2563eb" stopOpacity={0.78} />
                        <stop offset="52%" stopColor="#d97706" stopOpacity={0.72} />
                        <stop offset="100%" stopColor="#16a34a" stopOpacity={0.78} />
                      </linearGradient>
                      <linearGradient id="andamentoWaveFill" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#042558" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#042558" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#d9e2f1" strokeDasharray="4 6" vertical={false} />
                    <XAxis
                      dataKey="stage"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#042558", fontSize: 12, fontWeight: 600 }}
                      dy={10}
                    />
                    <YAxis
                      allowDecimals={false}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#64748b", fontSize: 12 }}
                      width={34}
                    />
                    <Tooltip
                      cursor={{ stroke: "#042558", strokeOpacity: 0.18, strokeWidth: 2 }}
                      contentStyle={{
                        border: "1px solid #d9e2f1",
                        borderRadius: 12,
                        boxShadow: "0 12px 30px rgba(4, 37, 88, 0.12)",
                      }}
                      formatter={(value, name, item) => {
                        const payload = item.payload as { percentual: number };
                        return [`${value} (${payload.percentual}%)`, "Quantidade"];
                      }}
                      labelStyle={{ color: "#042558", fontWeight: 700 }}
                    />
                    <Area
                      type="natural"
                      dataKey="quantidade"
                      stroke="url(#andamentoWave)"
                      strokeWidth={5}
                      fill="url(#andamentoWaveFill)"
                      activeDot={{ r: 7, strokeWidth: 3, stroke: "#ffffff" }}
                      dot={({ cx, cy, payload }) => (
                        <circle
                          cx={cx}
                          cy={cy}
                          r={6}
                          fill={(payload as { color: string }).color}
                          stroke="#ffffff"
                          strokeWidth={3}
                        />
                      )}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-3">
              {STAGES.map((stage) => {
                const Icon = stage.icon;
                const value = stats.counts[stage.key];
                const percent = stats.total === 0 ? 0 : Math.round((value / stats.total) * 100);

                return (
                  <article key={stage.key} className="rounded-2xl border border-[#042558]/10 bg-white p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span className="rounded-lg p-2" style={{ backgroundColor: `${stage.color}18`, color: stage.color }}>
                          <Icon className="h-5 w-5" />
                        </span>
                        <div>
                          <h3 className="font-semibold text-[#042558]">{stage.label}</h3>
                          <p className="text-xs text-[#042558]/50">{stage.description}</p>
                        </div>
                      </div>
                      <span className="text-2xl font-bold text-[#042558]">{value}</span>
                    </div>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#042558]/8">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${percent}%`, backgroundColor: stage.color }}
                      />
                    </div>
                    <p className="mt-2 text-xs font-medium text-[#042558]/55">{percent}% do projeto</p>
                  </article>
                );
              })}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
