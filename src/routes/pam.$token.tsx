import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Save,
} from "lucide-react";
import {
  displayPamImprovementPoint,
  isPamItemFilled,
  itemStatusLabel,
  statusLabel,
  type PamItemStatus,
} from "@/lib/pam";

type PamData = {
  ok: true;
  editable: boolean;
  pam: {
    id: string;
    employeeName: string;
    jobTitle: string | null;
    feedbackDate: string | null;
    status: string;
    completedAt: string | null;
  };
  items: PamItem[];
};

type PamItem = {
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

type PamError = { error: string; message: string };

const textAreaClass =
  "min-h-28 w-full resize-y rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 outline-none transition focus:border-[#042558] focus:ring-2 focus:ring-[#042558]/15 disabled:bg-gray-50 disabled:text-gray-500";

export const Route = createFileRoute("/pam/$token")({
  component: PublicPamPage,
});

function PublicPamPage() {
  const { token } = Route.useParams();
  const [state, setState] = useState<"loading" | "ready" | "error" | "completing" | "success">(
    "loading",
  );
  const [data, setData] = useState<PamData | null>(null);
  const [items, setItems] = useState<PamItem[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const dirtyItemId = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/public/pam/${token}`)
      .then(async (response) => {
        const json = (await response.json()) as PamData | PamError;
        if (cancelled) return;
        if (!response.ok || "error" in json) {
          setErrorMsg((json as PamError).message ?? "Nao foi possivel carregar o PAM.");
          setState("error");
          return;
        }
        setData(json);
        setItems(json.items ?? []);
        setSelectedId(json.items?.[0]?.id ?? "");
        setState("ready");
      })
      .catch(() => {
        if (!cancelled) {
          setErrorMsg("Erro de conexao.");
          setState("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const selectedItem = items.find((item) => item.id === selectedId) ?? items[0] ?? null;
  const completedCount = items.filter((item) => item.status === "completed").length;
  const filledCount = items.filter(isPamItemFilled).length;
  const allFilled = items.length > 0 && items.every(isPamItemFilled);
  const progressPercent = items.length ? Math.round((completedCount / items.length) * 100) : 0;
  const editable = Boolean(data?.editable && data.pam.status !== "completed");
  const currentIndex = useMemo(
    () => Math.max(0, items.findIndex((item) => item.id === selectedItem?.id)),
    [items, selectedItem?.id],
  );

  useEffect(() => {
    if (!dirtyItemId.current || !editable) return;
    const item = items.find((candidate) => candidate.id === dirtyItemId.current);
    if (!item) return;
    const timeout = window.setTimeout(async () => {
      setSaveState("saving");
      try {
        const response = await fetch(`/api/public/pam-draft/${token}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            itemId: item.id,
            problem_reason: item.problem_reason,
            improvement_plan: item.improvement_plan,
            evidence_plan: item.evidence_plan,
            review_date: item.review_date,
            status: item.status,
          }),
        });
        const json = (await response.json()) as { ok?: true; savedAt?: string } | PamError;
        if (!response.ok || "error" in json) {
          setSaveState("error");
          return;
        }
        dirtyItemId.current = null;
        setSavedAt(json.savedAt ?? new Date().toISOString());
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    }, 700);
    return () => window.clearTimeout(timeout);
  }, [editable, items, token]);

  const updateItem = (itemId: string, patch: Partial<PamItem>) => {
    dirtyItemId.current = itemId;
    setItems((current) =>
      current.map((item) => {
        if (item.id !== itemId) return item;
        const nextItem = { ...item, ...patch };
        return {
          ...nextItem,
          status: patch.status ?? automaticItemStatus(nextItem, item.status),
        };
      }),
    );
  };

  const completeItem = (item: PamItem) => {
    if (!isPamItemFilled(item)) {
      setErrorMsg("Preencha todos os campos deste ponto antes de concluir.");
      return;
    }
    setErrorMsg("");
    updateItem(item.id, { status: "completed" });
  };

  const completePam = async () => {
    if (!allFilled) {
      setErrorMsg("Preencha todos os pontos antes de concluir o PAM.");
      return;
    }
    setErrorMsg("");
    setState("completing");
    try {
      const response = await fetch(`/api/public/pam-complete/${token}`, { method: "POST" });
      const json = (await response.json()) as { ok?: true; completedAt?: string } | PamError;
      if (!response.ok || "error" in json) {
        setErrorMsg((json as PamError).message ?? "Nao foi possivel concluir.");
        setState("ready");
        return;
      }
      setItems((current) => current.map((item) => ({ ...item, status: "completed" })));
      setData((current) =>
        current
          ? {
              ...current,
              editable: false,
              pam: {
                ...current.pam,
                status: "completed",
                completedAt: json.completedAt ?? new Date().toISOString(),
              },
            }
          : current,
      );
      setState("success");
    } catch {
      setErrorMsg("Erro de conexao.");
      setState("ready");
    }
  };

  return (
    <div className="min-h-screen bg-[#042558]/5 px-4 py-6 md:px-6 md:py-10">
      <div className="mx-auto max-w-6xl">
        {state === "loading" && (
          <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-[#042558]/55">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-sm">Carregando PAM...</p>
          </div>
        )}

        {state === "error" && (
          <div className="mx-auto mt-20 max-w-lg rounded-xl border border-red-200 bg-white p-8 text-center shadow-sm">
            <AlertCircle className="mx-auto mb-3 h-10 w-10 text-red-500" />
            <p className="text-sm text-gray-700">{errorMsg}</p>
          </div>
        )}

        {(state === "ready" || state === "completing" || state === "success") && data && (
          <div className="space-y-5">
            <header className="rounded-xl border border-[#042558]/10 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl font-bold text-[#042558]">
                      PAM - Plano de Acao de Melhorias
                    </h1>
                    <span className="rounded-full bg-[#042558]/10 px-2.5 py-1 text-xs font-medium text-[#042558]">
                      {statusLabel(data.pam.status)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-[#042558]/65">
                    {data.pam.employeeName} - {data.pam.jobTitle || "Cargo nao informado"} -
                    Feedback: {formatDate(data.pam.feedbackDate)}
                  </p>
                </div>
                <SaveFeedback state={saveState} savedAt={savedAt} completed={data.pam.status === "completed"} />
              </div>
              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between text-xs font-medium text-[#042558]/55">
                  <span>{completedCount} de {items.length} pontos concluidos</span>
                  <span>{progressPercent}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[#042558]/10">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </header>

            {state === "success" && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-800">
                <div className="flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="h-5 w-5" /> Plano de acao concluido
                </div>
                <p className="mt-1 text-sm text-emerald-700">
                  As respostas foram registradas e agora ficam disponiveis para o gestor.
                </p>
              </div>
            )}

            {errorMsg && state !== "success" && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {errorMsg}
              </p>
            )}

            <main className="grid gap-5 md:grid-cols-[320px_1fr]">
              <aside className={`${mobileDetailOpen ? "hidden md:block" : "block"} space-y-3`}>
                <h2 className="text-sm font-bold uppercase tracking-wider text-[#042558]/60">
                  Pontos de melhoria
                </h2>
                {items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setSelectedId(item.id);
                      setMobileDetailOpen(true);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className={`w-full rounded-lg border bg-white p-4 text-left shadow-sm transition ${
                      selectedItem?.id === item.id
                        ? "border-[#042558] ring-2 ring-[#042558]/10"
                        : "border-[#042558]/10 hover:border-[#042558]/30"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[#042558]">
                          {displayPamImprovementPoint(item.improvement_point, fallbackItemTitle(item))}
                        </p>
                        <p className="mt-1 text-sm text-[#042558]/55">
                          {item.skill_label || "Habilidade nao informada"}
                        </p>
                      </div>
                      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-[#042558]/35 md:hidden" />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#042558]/10 px-2 py-0.5 text-xs font-medium text-[#042558]">
                        {itemStatusLabel(item.status)}
                      </span>
                      {isPamItemFilled(item) && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          <Check className="h-3 w-3" /> preenchido
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </aside>

              <section className={`${mobileDetailOpen ? "block" : "hidden md:block"}`}>
                {selectedItem && (
                  <ActionPlanEditor
                    item={selectedItem}
                    index={currentIndex + 1}
                    total={items.length}
                    editable={editable}
                    onBack={() => setMobileDetailOpen(false)}
                    onChange={(patch) => updateItem(selectedItem.id, patch)}
                    onComplete={() => completeItem(selectedItem)}
                  />
                )}
              </section>
            </main>

            <footer className="sticky bottom-0 -mx-4 border-t border-gray-200 bg-white/95 px-4 py-3 shadow-[0_-8px_24px_rgba(4,37,88,0.08)] backdrop-blur md:static md:mx-0 md:rounded-xl md:border md:border-[#042558]/10 md:shadow-sm">
              <div className="mx-auto flex max-w-6xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <p className="text-sm text-[#042558]/60">
                  {filledCount} de {items.length} pontos preenchidos
                </p>
                <button
                  onClick={() => void completePam()}
                  disabled={!editable || !allFilled || state === "completing"}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#042558] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#042558]/90 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {state === "completing" ? "Concluindo..." : "Concluir Plano de Acao"}
                </button>
              </div>
            </footer>
          </div>
        )}
      </div>
    </div>
  );
}

function ActionPlanEditor({
  item,
  index,
  total,
  editable,
  onBack,
  onChange,
  onComplete,
}: {
  item: PamItem;
  index: number;
  total: number;
  editable: boolean;
  onBack: () => void;
  onChange: (patch: Partial<PamItem>) => void;
  onComplete: () => void;
}) {
  return (
    <article className="rounded-xl border border-[#042558]/10 bg-white p-5 shadow-sm">
      <button
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-[#042558] md:hidden"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar aos pontos
      </button>
      <div className="flex flex-col gap-3 border-b border-gray-200 pb-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#042558]/45">
            Ponto {index} de {total}
          </p>
          <h2 className="mt-1 text-xl font-semibold text-[#042558]">
            {displayPamImprovementPoint(item.improvement_point, fallbackItemTitle(item))}
          </h2>
          <p className="mt-1 text-sm text-[#042558]/60">
            Habilidade: {item.skill_label || "Nao informada"}
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-5">
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-gray-700">
            Por que isso e um problema?
          </span>
          <textarea
            disabled={!editable}
            value={item.problem_reason ?? ""}
            onChange={(event) => onChange({ problem_reason: event.target.value })}
            className={textAreaClass}
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-gray-700">
            Como voce pretende melhorar?
          </span>
          <textarea
            disabled={!editable}
            value={item.improvement_plan ?? ""}
            onChange={(event) => onChange({ improvement_plan: event.target.value })}
            className={textAreaClass}
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-gray-700">
            Como vai conferir a evolucao?
          </span>
          <textarea
            disabled={!editable}
            value={item.evidence_plan ?? ""}
            onChange={(event) => onChange({ evidence_plan: event.target.value })}
            className={textAreaClass}
          />
        </label>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          onClick={onComplete}
          disabled={!editable || !isPamItemFilled(item)}
          className="inline-flex items-center gap-2 rounded-lg bg-[#042558] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-[#042558]/20 transition hover:bg-[#042558]/90 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none"
        >
          <Check className="h-4 w-4" /> Concluir aba
        </button>
      </div>
    </article>
  );
}

function SaveFeedback({
  state,
  savedAt,
  completed,
}: {
  state: "idle" | "saving" | "saved" | "error";
  savedAt: string | null;
  completed: boolean;
}) {
  if (completed) {
    return <span className="text-sm font-medium text-emerald-700">Concluido</span>;
  }
  if (state === "saving") {
    return (
      <span className="inline-flex items-center gap-2 text-sm text-[#042558]/55">
        <Loader2 className="h-4 w-4 animate-spin" /> Salvando...
      </span>
    );
  }
  if (state === "saved") {
    return (
      <span className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700">
        <Save className="h-4 w-4" /> Salvo
        {savedAt ? ` ${new Date(savedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : ""}
      </span>
    );
  }
  if (state === "error") {
    return <span className="text-sm font-medium text-red-600">Erro ao salvar</span>;
  }
  return <span className="text-sm text-[#042558]/45">Salvo automaticamente</span>;
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value.length === 10 ? `${value}T00:00:00` : value).toLocaleDateString("pt-BR");
}

function automaticItemStatus(item: PamItem, currentStatus: PamItemStatus): PamItemStatus {
  if (currentStatus === "completed" && isPamItemFilled(item)) return "completed";
  const hasAnyText =
    item.problem_reason.trim() || item.improvement_plan.trim() || item.evidence_plan.trim();
  return hasAnyText ? "in_progress" : "not_started";
}

function fallbackItemTitle(item: PamItem) {
  if (item.source_key?.startsWith("activities_")) {
    return `Atividade ${item.source_key.match(/\d+$/)?.[0] ?? ""}`.trim();
  }
  return item.skill_label || "Ponto de melhoria";
}
