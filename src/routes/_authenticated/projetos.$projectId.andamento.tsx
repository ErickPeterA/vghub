import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { FileText, Loader2, TrendingUp } from "lucide-react";
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
import { apiJson } from "@/lib/api";

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
}> = [
  {
    key: "em_criacao",
    label: "Em criação",
    description: "descrições ainda sendo montadas",
    color: "#2563eb",
  },
  {
    key: "em_aprovacao",
    label: "Em aprovação",
    description: "descrições aguardando validação",
    color: "#d97706",
  },
  {
    key: "concluido",
    label: "Concluídos",
    description: "descrições finalizadas",
    color: "#16a34a",
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
      try {
        const { rows } = await apiJson<{ ok: boolean; rows: DcRow[] }>(
          `/api/projects/${projectId}/dc?mode=progress`,
        );
        if (!active) return;
        setRows(rows ?? []);
      } catch (error) {
        if (!active) return;
        toast.error(error instanceof Error ? error.message : "Erro ao carregar andamento.");
        setRows([]);
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
    const approval = counts.em_aprovacao;
    const progress =
      total === 0 ? 0 : Math.round(((counts.concluido + approval * 0.55) / total) * 100);
    const waveData = STAGES.map((stage) => ({
      stage: stage.label,
      key: stage.key,
      quantidade: counts[stage.key],
      percentual: total === 0 ? 0 : Math.round((counts[stage.key] / total) * 100),
      color: stage.color,
    }));

    return {
      counts,
      total,
      active: counts.em_criacao + counts.em_aprovacao,
      progress,
      waveData,
    };
  }, [rows]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#042558]/5 via-white to-[#f59e0b]/5 px-4 py-6 text-[#042558] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-xl border border-[#042558]/10 bg-white/90 p-5 shadow-sm backdrop-blur-sm sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#042558]/45">
                Dashboard
              </p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#042558] sm:text-3xl">
                Andamento do projeto
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#042558]/60">
                A onda mostra quantas descrições estão em criação, em aprovação e concluídas.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[560px]">
              <MetricCard label="Total" value={stats.total} />
              <MetricCard label="Em andamento" value={stats.active} />
              <MetricCard label="Em aprovação" value={stats.counts.em_aprovacao} tone="amber" />
              <MetricCard label="Progresso" value={`${stats.progress}%`} tone="navy" />
            </div>
          </div>
        </header>

        {loading ? (
          <div className="flex h-72 items-center justify-center rounded-xl border border-[#042558]/10 bg-white/75">
            <Loader2 className="h-7 w-7 animate-spin text-[#042558]" />
          </div>
        ) : stats.total === 0 ? (
          <div className="flex h-72 flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#042558]/20 bg-white/75 text-center">
            <FileText className="mb-3 h-9 w-9 text-[#042558]/30" />
            <h2 className="text-lg font-semibold text-[#042558]">Sem descrições para acompanhar</h2>
            <p className="mt-1 text-sm text-[#042558]/55">
              Quando houver descrições de cargo no projeto, a onda aparece aqui.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            <section className="rounded-xl border border-[#042558]/10 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-[#042558]">Onda de andamento</h2>
                  <p className="text-sm text-[#042558]/55">
                    Baseada no estágio atual das descrições de cargo.
                  </p>
                </div>
                <span className="inline-flex w-fit items-center gap-2 rounded-lg bg-[#042558]/5 px-3 py-2 text-sm font-medium text-[#042558]/70">
                  <TrendingUp className="h-4 w-4" />
                  {stats.total} descrições
                </span>
              </div>

              <div className="h-[360px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={stats.waveData}
                    margin={{ top: 18, right: 18, left: 0, bottom: 8 }}
                  >
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
          </div>
        )}
      </div>
    </main>
  );
}

function MetricCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number | string;
  tone?: "default" | "amber" | "navy";
}) {
  const toneClass =
    tone === "navy"
      ? "border-[#042558] bg-[#042558] text-white"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-[#042558]/10 bg-white text-[#042558]";
  const labelClass = tone === "navy" ? "text-white/65" : "text-[#042558]/55";

  return (
    <div className={`rounded-xl border px-4 py-3 shadow-sm ${toneClass}`}>
      <p className={`text-xs font-medium ${labelClass}`}>{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

