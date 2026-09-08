import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ClipboardCopy,
  ExternalLink,
  Link2,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldOff,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { apiJson } from "@/lib/api";
import {
  buildPamSuggestions,
  displayPamImprovementPoint,
  isPamItemFilled,
  itemStatusLabel,
  statusLabel,
  type PamItemStatus,
  type PamStatus,
} from "@/lib/pam";

type ReviewRow = {
  id: string;
  project_id: string;
  employee_id: string | null;
  employee_name: string;
  job_title: string;
  name: string;
  review_type?: "experience" | "performance" | null;
  status: string;
  finalized_at: string | null;
  due_date?: string | null;
  score_summary_snapshot?: unknown;
  questions_snapshot?: unknown;
};

type ParticipantRow = {
  review_id: string;
  participant_type: "collaborator" | "leader";
  response_answers: Record<string, string>;
};

type PamRow = {
  id: string;
  project_id: string;
  employee_id: string | null;
  review_id: string | null;
  token: string;
  employee_name: string;
  job_title: string | null;
  feedback_date: string | null;
  status: PamStatus;
  released_at: string | null;
  completed_at: string | null;
  link_revoked_at: string | null;
  created_at: string;
};

type PamItemRow = {
  id: string;
  pam_id: string;
  source: string;
  source_key: string | null;
  source_score: number | null;
  improvement_point: string;
  skill_label: string | null;
  problem_reason: string;
  improvement_plan: string;
  evidence_plan: string;
  review_date: string | null;
  status: PamItemStatus;
  display_order: number;
};

const inputClass =
  "w-full rounded-lg border border-[#042558]/15 bg-white px-3 py-2 text-sm text-[#042558] outline-none transition focus:border-[#042558] focus:ring-2 focus:ring-[#042558]/15";

export function PamManager({ projectId }: { projectId: string }) {
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const [pams, setPams] = useState<PamRow[]>([]);
  const [items, setItems] = useState<PamItemRow[]>([]);
  const [selectedPamId, setSelectedPamId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [manualTitle, setManualTitle] = useState("");
  const [manualSkill, setManualSkill] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiJson<{
        ok: boolean;
        reviews: ReviewRow[];
        participants: ParticipantRow[];
        pams: PamRow[];
        items: PamItemRow[];
      }>(`/api/projects/${projectId}/pam`);

      const nextPams = data.pams ?? [];
      setReviews((data.reviews ?? []).filter((row) => row.review_type !== "experience"));
      setParticipants(data.participants ?? []);
      setPams(nextPams);
      setItems(data.items ?? []);
      setSelectedPamId((current) => current || nextPams[0]?.id || "");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao carregar PAM.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedPam = pams.find((pam) => pam.id === selectedPamId) ?? pams[0] ?? null;
  const selectedItems = items.filter((item) => item.pam_id === selectedPam?.id);
  const pamByReview = useMemo(
    () => new Map(pams.filter((pam) => pam.review_id).map((pam) => [pam.review_id, pam])),
    [pams],
  );

  const createPam = async (review: ReviewRow) => {
    const existing = pamByReview.get(review.id);
    if (existing) {
      setSelectedPamId(existing.id);
      toast.info("Este PAM ja existe.");
      return;
    }

    const collaborator = participants.find((participant) => participant.review_id === review.id);
    const suggestions = buildPamSuggestions(review, collaborator?.response_answers ?? {}, 80);
    const feedbackDate = (review.finalized_at ?? new Date().toISOString()).slice(0, 10);

    try {
      const { pam } = await apiJson<{ ok: boolean; pam: PamRow }>(`/api/projects/${projectId}/pam`, {
        method: "POST",
        body: {
          action: "create_pam",
          reviewId: review.id,
          employeeId: review.employee_id,
          employeeName: review.employee_name,
          jobTitle: review.job_title,
          feedbackDate,
          items: suggestions.map((suggestion, index) => ({
            source: suggestion.source,
            source_key: suggestion.source_key,
            source_score: suggestion.source_score,
            improvement_point: suggestion.improvement_point,
            skill_label: suggestion.skill_label,
            display_order: index + 1,
          })),
        },
      });

      if (!suggestions.length) {
        toast.info("Nenhum ponto abaixo de 80% foi encontrado; adicione pontos manuais.");
      }

      setSelectedPamId(pam.id);
      toast.success("PAM criado como rascunho");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel criar o PAM.");
    }
  };
  const addManualItem = async () => {
    if (!selectedPam || !manualTitle.trim()) {
      toast.error("Informe o ponto de melhoria.");
      return;
    }
    try {
      await apiJson(`/api/projects/${projectId}/pam`, {
        method: "POST",
        body: {
          action: "add_item",
          pamId: selectedPam.id,
          source: "manual",
          improvementPoint: manualTitle.trim(),
          skillLabel: manualSkill.trim() || "Ponto manual",
          displayOrder: selectedItems.length + 1,
        },
      });
      setManualTitle("");
      setManualSkill("");
      toast.success("Ponto adicionado");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao adicionar ponto.");
    }
  };
  const deleteItem = async (item: PamItemRow) => {
    if (!confirm("Remover este ponto do PAM?")) return;
    try {
      await apiJson(`/api/projects/${projectId}/pam?itemId=${item.id}`, { method: "DELETE" });
      toast.success("Ponto removido");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao remover ponto.");
    }
  };
  const updatePam = async (pam: PamRow, patch: Partial<PamRow>, success: string) => {
    try {
      await apiJson(`/api/projects/${projectId}/pam`, {
        method: "PATCH",
        body: { pamId: pam.id, patch },
      });
      toast.success(success);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao atualizar PAM.");
    }
  };
  const releaseAndCopy = async (pam: PamRow) => {
    try {
      await apiJson(`/api/projects/${projectId}/pam`, {
        method: "PATCH",
        body: {
          pamId: pam.id,
          patch: {
            status: pam.status === "draft" ? "released" : pam.status,
            released_at: pam.released_at ?? new Date().toISOString(),
            link_revoked_at: null,
          },
        },
      });
      await navigator.clipboard.writeText(publicPamUrl(pam.token));
      toast.success("Link liberado e copiado");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao liberar link.");
    }
  };
  const copyLink = async (pam: PamRow) => {
    await navigator.clipboard.writeText(publicPamUrl(pam.token));
    toast.success("Link copiado");
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Carregando PAM...
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#042558]/50">
            Plano de Acao de Melhorias
          </p>
          <h1 className="font-display text-3xl text-[#042558]">PAM</h1>
        </div>
        <button
          onClick={() => void load()}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#042558]/15 px-3 py-2 text-sm font-medium text-[#042558] hover:bg-[#042558]/5"
        >
          <RefreshCw className="h-4 w-4" /> Atualizar
        </button>
      </header>

      <section className="grid gap-4 lg:grid-cols-[minmax(280px,360px)_1fr]">
        <div className="space-y-4">
          <div className="rounded-xl border border-[#042558]/10 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-[#042558]">Avaliacoes finalizadas</h2>
            <div className="mt-3 space-y-2">
              {reviews.length === 0 ? (
                <p className="rounded-lg bg-[#042558]/5 p-3 text-sm text-[#042558]/55">
                  Nenhuma avaliacao de desempenho finalizada.
                </p>
              ) : (
                reviews.map((review) => {
                  const existing = pamByReview.get(review.id);
                  return (
                    <div key={review.id} className="rounded-lg border border-[#042558]/10 p-3">
                      <p className="text-sm font-medium text-[#042558]">{review.employee_name}</p>
                      <p className="text-xs text-[#042558]/55">
                        {review.job_title} - {formatDate(review.finalized_at)}
                      </p>
                      {existing ? (
                        <button
                          onClick={() => setSelectedPamId(existing.id)}
                          className="mt-2 text-xs font-semibold text-[#042558] hover:underline"
                        >
                          Ver PAM existente
                        </button>
                      ) : (
                        <button
                          onClick={() => void createPam(review)}
                          className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-[#042558] px-3 py-2 text-xs font-medium text-white"
                        >
                          <Plus className="h-3.5 w-3.5" /> Criar PAM
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="rounded-xl border border-[#042558]/10 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-[#042558]">PAMs</h2>
            <div className="mt-3 space-y-2">
              {pams.length === 0 ? (
                <p className="rounded-lg bg-[#042558]/5 p-3 text-sm text-[#042558]/55">
                  Crie um PAM a partir de uma avaliacao finalizada.
                </p>
              ) : (
                pams.map((pam) => {
                  const pamItems = items.filter((item) => item.pam_id === pam.id);
                  const completed = pamItems.filter((item) => item.status === "completed").length;
                  const active = pam.id === selectedPam?.id;
                  return (
                    <button
                      key={pam.id}
                      onClick={() => setSelectedPamId(pam.id)}
                      className={`w-full rounded-lg border p-3 text-left transition ${
                        active
                          ? "border-[#042558] bg-[#042558]/5"
                          : "border-[#042558]/10 hover:bg-[#042558]/5"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-[#042558]">{pam.employee_name}</p>
                          <p className="text-xs text-[#042558]/55">{pam.job_title || "Cargo nao informado"}</p>
                        </div>
                        <span className="rounded-full bg-[#042558]/10 px-2 py-0.5 text-[11px] font-medium text-[#042558]">
                          {statusLabel(pam.link_revoked_at ? "revoked" : pam.status)}
                        </span>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#042558]/10">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${pamItems.length ? (completed / pamItems.length) * 100 : 0}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-[#042558]/55">
                        {completed} de {pamItems.length} pontos concluidos
                      </p>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="min-w-0">
          {selectedPam ? (
            <PamDetail
              pam={selectedPam}
              items={selectedItems}
              manualTitle={manualTitle}
              manualSkill={manualSkill}
              onManualTitle={setManualTitle}
              onManualSkill={setManualSkill}
              onAddManual={() => void addManualItem()}
              onRelease={() => void releaseAndCopy(selectedPam)}
              onCopy={() => void copyLink(selectedPam)}
              onRevoke={() =>
                void updatePam(
                  selectedPam,
                  { link_revoked_at: new Date().toISOString() } as Partial<PamRow>,
                  "Link revogado",
                )
              }
              onReopen={() =>
                void updatePam(
                  selectedPam,
                  {
                    status: "released",
                    completed_at: null,
                    link_revoked_at: null,
                  } as Partial<PamRow>,
                  "PAM reaberto",
                )
              }
              onDeleteItem={(item) => void deleteItem(item)}
            />
          ) : (
            <div className="flex min-h-64 items-center justify-center rounded-xl border border-dashed border-[#042558]/15 text-sm text-[#042558]/45">
              Selecione ou crie um PAM.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function PamDetail({
  pam,
  items,
  manualTitle,
  manualSkill,
  onManualTitle,
  onManualSkill,
  onAddManual,
  onRelease,
  onCopy,
  onRevoke,
  onReopen,
  onDeleteItem,
}: {
  pam: PamRow;
  items: PamItemRow[];
  manualTitle: string;
  manualSkill: string;
  onManualTitle: (value: string) => void;
  onManualSkill: (value: string) => void;
  onAddManual: () => void;
  onRelease: () => void;
  onCopy: () => void;
  onRevoke: () => void;
  onReopen: () => void;
  onDeleteItem: (item: PamItemRow) => void;
}) {
  const completed = items.filter((item) => item.status === "completed").length;
  const filled = items.filter(isPamItemFilled).length;
  const linkAvailable = pam.status !== "draft" && !pam.link_revoked_at;

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-[#042558]/10 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#042558]/50">
              PAM - Plano de Acao de Melhorias
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[#042558]">{pam.employee_name}</h2>
            <p className="mt-1 text-sm text-[#042558]/60">
              {pam.job_title || "Cargo nao informado"} - Feedback: {formatDate(pam.feedback_date)}
            </p>
            <span className="mt-3 inline-flex rounded-full bg-[#042558]/10 px-2.5 py-1 text-xs font-medium text-[#042558]">
              {statusLabel(pam.link_revoked_at ? "revoked" : pam.status)}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={onRelease}
              className="inline-flex items-center gap-2 rounded-lg bg-[#042558] px-3 py-2 text-sm font-medium text-white"
            >
              <Link2 className="h-4 w-4" /> Liberar/copiar link
            </button>
            {linkAvailable && (
              <>
                <button
                  onClick={onCopy}
                  className="inline-flex items-center gap-2 rounded-lg border border-[#042558]/15 px-3 py-2 text-sm font-medium text-[#042558] hover:bg-[#042558]/5"
                >
                  <ClipboardCopy className="h-4 w-4" /> Copiar
                </button>
                <a
                  href={publicPamUrl(pam.token)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-[#042558]/15 px-3 py-2 text-sm font-medium text-[#042558] hover:bg-[#042558]/5"
                >
                  <ExternalLink className="h-4 w-4" /> Abrir
                </a>
                <button
                  onClick={onRevoke}
                  className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                >
                  <ShieldOff className="h-4 w-4" /> Revogar
                </button>
              </>
            )}
            {pam.status === "completed" && (
              <button
                onClick={onReopen}
                className="inline-flex items-center gap-2 rounded-lg border border-amber-200 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-50"
              >
                <RotateCcw className="h-4 w-4" /> Reabrir
              </button>
            )}
          </div>
        </div>
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between text-xs font-medium text-[#042558]/55">
            <span>{completed} de {items.length} pontos concluidos</span>
            <span>{filled} preenchidos</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[#042558]/10">
            <div
              className="h-full rounded-full bg-emerald-500"
              style={{ width: `${items.length ? (completed / items.length) * 100 : 0}%` }}
            />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-[#042558]/10 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-[#042558]">Adicionar ponto extra</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_220px_auto] md:items-end">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[#042558]/45">
              Ponto de melhoria
            </span>
            <input value={manualTitle} onChange={(event) => onManualTitle(event.target.value)} className={inputClass} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[#042558]/45">
              Habilidade
            </span>
            <input value={manualSkill} onChange={(event) => onManualSkill(event.target.value)} className={inputClass} />
          </label>
          <button
            onClick={onAddManual}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#042558] px-4 py-2 text-sm font-medium text-white"
          >
            <Plus className="h-4 w-4" /> Adicionar
          </button>
        </div>
      </section>

      <section className="space-y-3">
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#042558]/15 p-8 text-center text-sm text-[#042558]/45">
            Nenhum ponto no PAM ainda.
          </div>
        ) : (
          items.map((item) => (
            <article key={item.id} className="rounded-xl border border-[#042558]/10 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-[#042558]">
                      {displayPamImprovementPoint(item.improvement_point, fallbackItemTitle(item))}
                    </h3>
                    {item.source_score !== null && (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                        {formatScore(item.source_score)}%
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-[#042558]/55">
                    Habilidade: {item.skill_label || "Nao informada"} - {item.source === "manual" ? "Manual" : "Avaliacao"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-[#042558]/10 px-2.5 py-1 text-xs font-medium text-[#042558]">
                    {itemStatusLabel(item.status)}
                  </span>
                  {pam.status !== "completed" && (
                    <button
                      onClick={() => onDeleteItem(item)}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Remover
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <AnswerPreview label="Por que e um problema?" value={item.problem_reason} />
                <AnswerPreview label="Como melhorar?" value={item.improvement_plan} />
                <AnswerPreview label="Como conferir a melhora?" value={item.evidence_plan} />
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}

function AnswerPreview({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-lg bg-[#042558]/5 p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-[#042558]/45">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm text-[#042558]">
        {value?.trim() || <span className="italic text-[#042558]/35">Sem resposta</span>}
      </p>
    </div>
  );
}

function publicPamUrl(token: string) {
  return `${window.location.origin}/pam/${token}`;
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value.length === 10 ? `${value}T00:00:00` : value).toLocaleDateString("pt-BR");
}

function formatScore(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(".", ",");
}

function fallbackItemTitle(item: PamItemRow) {
  if (item.source_key?.startsWith("activities_")) {
    return `Atividade ${item.source_key.match(/\d+$/)?.[0] ?? ""}`.trim();
  }
  return item.skill_label || "Ponto de melhoria";
}

