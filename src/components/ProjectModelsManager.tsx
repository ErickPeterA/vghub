import { useState } from "react";
import { ClipboardCheck, FileText, Layers } from "lucide-react";
import { BaseManager } from "@/components/BaseManager";
import { PerformancePeriodConfigPanel } from "@/components/PerformanceReviewManager";

type ModelBlock =
  | { key: "job_description"; label: string; description: string; icon: typeof FileText }
  | {
      key: "experience";
      label: string;
      description: string;
      icon: typeof ClipboardCheck;
      reviewType: "experience";
    }
  | {
      key: "performance";
      label: string;
      description: string;
      icon: typeof ClipboardCheck;
      reviewType: "performance";
    };

const blocks: ModelBlock[] = [
  {
    key: "job_description",
    label: "Modelo Descricao de cargo",
    description: "Campos, blocos, opcoes e limites usados como base nas descricoes do projeto.",
    icon: FileText,
  },
  {
    key: "experience",
    label: "Modelo de experiencia",
    description: "Perguntas usadas nas avaliacoes de 30, 45 e 90 dias.",
    icon: ClipboardCheck,
    reviewType: "experience",
  },
  {
    key: "performance",
    label: "Modelo de desempenho",
    description: "Perguntas usadas nas avaliacoes de 3 meses, 6 meses e 1 ano.",
    icon: ClipboardCheck,
    reviewType: "performance",
  },
];

export function ProjectModelsManager({ projectId = null }: { projectId?: string | null }) {
  const [selected, setSelected] = useState<ModelBlock>(blocks[0]);

  const selectedReviewType = "reviewType" in selected ? selected.reviewType : null;
  const isGlobal = projectId === null;

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#042558]/5 via-white to-[#042558]/5 px-6 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 rounded-2xl border border-[#042558]/10 bg-white/80 p-6 shadow-sm backdrop-blur-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#042558]/50">
            Configuracao
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#042558]">
            Configurar modelos
          </h1>
          <p className="mt-1 text-sm text-[#042558]/60">
            Defina os modelos que entram como base para as descricoes de cargo e avaliacoes de todos
            os projetos.
          </p>
        </div>

        <section className="mb-8">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#042558]">
            <Layers className="h-4 w-4" />
            Blocos de modelos
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {blocks.map((block) => {
              const active = selected.key === block.key;
              const Icon = block.icon;
              return (
                <button
                  key={block.key}
                  type="button"
                  onClick={() => setSelected(block)}
                  className={`rounded-xl border p-4 text-left transition ${
                    active
                      ? "border-[#042558] bg-[#042558] text-white shadow-lg shadow-[#042558]/20"
                      : "border-[#042558]/10 bg-white/75 text-[#042558] hover:border-[#042558]/35 hover:shadow-md"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-sm font-semibold leading-snug">{block.label}</h2>
                    <Icon
                      className={`h-5 w-5 shrink-0 ${active ? "text-white/70" : "text-[#042558]/35"}`}
                    />
                  </div>
                  <p
                    className={`mt-2 text-xs leading-relaxed ${active ? "text-white/70" : "text-[#042558]/55"}`}
                  >
                    {block.description}
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        {selected.key === "job_description" ? (
          <BaseManager
            projectId={projectId}
            title="Modelo Descricao de cargo"
            description={
              isGlobal
                ? "Esta e a base mestre. Novos projetos recebem uma copia independente destes campos e opcoes."
                : "Edite, desative, remova ou acrescente campos e opcoes sem alterar a Base Geral nem outros projetos."
            }
            embedded
          />
        ) : (
          <div className="rounded-2xl border border-[#042558]/10 bg-white/60 p-6 shadow-sm backdrop-blur-sm">
            <PerformancePeriodConfigPanel
              key={selected.key}
              projectId={projectId}
              initialReviewType={selectedReviewType}
              hideReviewTypeTabs
            />
          </div>
        )}
      </div>
    </main>
  );
}
