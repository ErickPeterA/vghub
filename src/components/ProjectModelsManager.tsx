import { useState } from "react";
import {
  ClipboardCheck,
  ClipboardList,
  FileText,
  Layers,
  Percent,
  SlidersHorizontal,
} from "lucide-react";
import { ActivityConfigManager } from "@/components/ActivityConfigManager";
import { BaseManager } from "@/components/BaseManager";
import {
  CriterionScoringSettings,
  EvaluationWeightsSettings,
} from "@/components/EvaluationScoringSettings";
import { PerformancePeriodConfigPanel } from "@/components/PerformanceReviewManager";

type ModelBlock =
  | { key: "job_description"; label: string; description: string; icon: typeof FileText }
  | { key: "activities"; label: string; description: string; icon: typeof ClipboardList }
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
    }
  | { key: "evaluation_weights"; label: string; description: string; icon: typeof Percent }
  | {
      key: "criterion_scoring";
      label: string;
      description: string;
      icon: typeof SlidersHorizontal;
    };

const blocks: ModelBlock[] = [
  {
    key: "job_description",
    label: "Modelo Descricao de cargo",
    description: "Campos, blocos, opcoes e limites usados como base nas descricoes do projeto.",
    icon: FileText,
  },
  {
    key: "activities",
    label: "Modelo de atividades",
    description: "Cabecalho e perguntas usados nos links de coleta de atividades.",
    icon: ClipboardList,
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
  {
    key: "evaluation_weights",
    label: "Pesos da Avaliação",
    description: "Defina quanto cada critério representa na nota final da avaliação.",
    icon: Percent,
  },
  {
    key: "criterion_scoring",
    label: "Pontuação dos Critérios",
    description: "Configure as notas aplicadas conforme o atendimento aos requisitos do cargo.",
    icon: SlidersHorizontal,
  },
];

export function ProjectModelsManager({ projectId = null }: { projectId?: string | null }) {
  const availableBlocks = projectId
    ? blocks
    : blocks.filter(
        (block) =>
          block.key !== "activities" &&
          block.key !== "evaluation_weights" &&
          block.key !== "criterion_scoring",
      );
  const [selected, setSelected] = useState<ModelBlock>(availableBlocks[0]);

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
            Configurações
          </h1>
          <p className="mt-1 text-sm text-[#042558]/60">
            {isGlobal
              ? "Defina os modelos que entram como base para as descricoes de cargo e avaliacoes de todos os projetos."
              : "Centralize os modelos, pesos e regras de pontuação utilizados nas avaliações deste projeto."}
          </p>
        </div>

        <section className="mb-8">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#042558]">
            <Layers className="h-4 w-4" />
            Blocos de modelos
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {availableBlocks.map((block) => {
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
        ) : selected.key === "activities" && projectId ? (
          <div className="rounded-2xl border border-[#042558]/10 bg-white/60 p-6 shadow-sm backdrop-blur-sm">
            <ActivityConfigManager projectId={projectId} />
          </div>
        ) : selected.key === "evaluation_weights" && projectId ? (
          <div className="rounded-2xl border border-[#042558]/10 bg-white/60 p-6 shadow-sm backdrop-blur-sm">
            <EvaluationWeightsSettings projectId={projectId} />
          </div>
        ) : selected.key === "criterion_scoring" && projectId ? (
          <div className="rounded-2xl border border-[#042558]/10 bg-white/60 p-6 shadow-sm backdrop-blur-sm">
            <CriterionScoringSettings projectId={projectId} />
          </div>
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
