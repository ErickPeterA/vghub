import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import {
  PublicPerformanceFormFields,
  validatePerformanceAnswers,
  type PerformanceQuestion,
} from "@/components/PerformanceReviewManager";

type FormData = {
  ok: true;
  reviewName: string;
  participantType: "collaborator" | "leader";
  employeeName: string;
  leaderName: string;
  jobTitle: string;
  header?: {
    sentAt?: string | null;
    expiresAt?: string | null;
    positionName?: string | null;
    careerType?: string | null;
    areaSector?: string | null;
    leaderPositionName?: string | null;
    employeeName?: string | null;
    leaderName?: string | null;
    admissionDate?: string | null;
  };
  draftAnswers?: Record<string, string>;
  draftSavedAt?: string | null;
  questions: PerformanceQuestion[];
};
type FormError = { error: string; message: string };

export const Route = createFileRoute("/avaliacao-desempenho/preencher/$token")({
  component: PublicPerformanceForm,
});

function PublicPerformanceForm() {
  const { token } = Route.useParams();
  const [state, setState] = useState<"loading" | "ready" | "error" | "submitting" | "success">(
    "loading",
  );
  const [form, setForm] = useState<FormData | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [errorMsg, setErrorMsg] = useState("");
  const [draftState, setDraftState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const hydratedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/public/performance-form/${token}`)
      .then(async (response) => {
        const json = (await response.json()) as FormData | FormError;
        if (cancelled) return;
        if (!response.ok || "error" in json) {
          setErrorMsg((json as FormError).message ?? "Não foi possível carregar o formulário.");
          setState("error");
          return;
        }
        setForm(json);
        setAnswers(json.draftAnswers ?? {});
        setDraftSavedAt(json.draftSavedAt ?? null);
        setState("ready");
        hydratedRef.current = true;
      })
      .catch(() => {
        if (!cancelled) {
          setErrorMsg("Erro de conexão.");
          setState("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!hydratedRef.current || state !== "ready") return;
    const timeout = window.setTimeout(async () => {
      setDraftState("saving");
      try {
        const response = await fetch(`/api/public/performance-draft/${token}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers }),
        });
        const json = (await response.json()) as { ok?: true; savedAt?: string } | FormError;
        if (!response.ok || "error" in json) {
          setDraftState("error");
          return;
        }
        setDraftSavedAt(json.savedAt ?? new Date().toISOString());
        setDraftState("saved");
      } catch {
        setDraftState("error");
      }
    }, 900);
    return () => window.clearTimeout(timeout);
  }, [answers, state, token]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form) return;
    const validation = validatePerformanceAnswers(form.questions, answers, form.participantType);
    if (validation) {
      setErrorMsg(validation);
      return;
    }
    setErrorMsg("");
    setState("submitting");
    try {
      const response = await fetch(`/api/public/performance-response/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const json = (await response.json()) as { ok?: true } | FormError;
      if (!response.ok || "error" in json) {
        setErrorMsg((json as FormError).message ?? "Erro ao enviar.");
        setState("ready");
        return;
      }
      setState("success");
    } catch {
      setErrorMsg("Erro de conexão.");
      setState("ready");
    }
  };

  return (
    <div className="min-h-screen bg-[#042558]/5 px-4 py-12">
      <div className="mx-auto max-w-3xl overflow-hidden rounded-xl bg-white shadow-lg shadow-[#042558]/10">
        <div className="bg-[#042558] px-8 py-6">
          <p className="text-xs font-medium uppercase tracking-wider text-white/60">
            Avaliação de Desempenho
          </p>
          <h1 className="text-2xl font-bold text-white">{form?.reviewName ?? "Preenchimento"}</h1>
          {form && (
            <p className="mt-1 text-sm text-white/70">
              {form.participantType === "collaborator" ? "Autoavaliação" : "Avaliação do líder"} ·{" "}
              {form.employeeName} · {form.jobTitle}
            </p>
          )}
        </div>
        <div className="p-8">
          {form && <EvaluationHeader header={form.header} />}

          {(state === "ready" || state === "submitting") && (
            <div className="mb-6 rounded-lg bg-gray-50 px-4 py-2 text-xs text-gray-500">
              {draftState === "saving" && <span>Salvando rascunho...</span>}
              {draftState === "saved" && (
                <span>
                  Rascunho salvo{" "}
                  {draftSavedAt
                    ? `às ${new Date(draftSavedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
                    : ""}
                </span>
              )}
              {draftState === "error" && <span>Erro ao salvar rascunho</span>}
              {draftState === "idle" && draftSavedAt && (
                <span>Rascunho de {new Date(draftSavedAt).toLocaleString("pt-BR")}</span>
              )}
            </div>
          )}

          {state === "loading" && (
            <div className="flex flex-col items-center justify-center gap-4 py-16">
              <Loader2 className="h-8 w-8 animate-spin text-[#042558]" />
              <p className="text-sm text-gray-400">Carregando formulário...</p>
            </div>
          )}

          {state === "error" && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center">
              <AlertCircle className="mx-auto mb-3 h-10 w-10 text-red-500" />
              <p className="text-gray-700">{errorMsg}</p>
            </div>
          )}

          {state === "success" && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-8 text-center">
              <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-500" />
              <h3 className="text-lg font-semibold text-emerald-700">Resposta enviada!</h3>
              <p className="mt-1 text-sm text-emerald-600">Obrigado por preencher a avaliação.</p>
            </div>
          )}

          {(state === "ready" || state === "submitting") && form && (
            <form onSubmit={submit} className="space-y-6">
              <PublicPerformanceFormFields
                questions={form.questions}
                participantType={form.participantType}
                answers={answers}
                onChange={setAnswers}
              />
              {errorMsg && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                  {errorMsg}
                </p>
              )}
              <button
                type="submit"
                disabled={state === "submitting"}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#042558] px-6 py-3 text-sm font-medium text-white hover:bg-[#042558]/90 disabled:opacity-50"
              >
                {state === "submitting" ? "Enviando..." : "Enviar respostas"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function EvaluationHeader({ header }: { header?: FormData["header"] }) {
  if (!header) return null;
  const fields = [
    ["Nomenclatura do Cargo", header.positionName],
    ["Tipo de Carreira do Cargo", header.careerType],
    ["Área/Setor do Cargo", header.areaSector],
    ["Cargo do Superior Imediato", header.leaderPositionName],
    ["Nome do colaborador", header.employeeName],
    ["Nome do superior imediato", header.leaderName],
    ["Data de Admissão", formatHeaderDate(header.admissionDate)],
  ];

  return (
    <section className="mb-6 overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="grid gap-px bg-gray-200 md:grid-cols-2">
        <HeaderItem label="Data de Envio da Avaliação" value={formatHeaderDateTime(header.sentAt)} />
        <HeaderItem label="Data Máxima de preenchimento" value={formatHeaderDateTime(header.expiresAt)} />
      </div>
      <div className="grid gap-px bg-gray-200 md:grid-cols-2">
        {fields.map(([label, value]) => (
          <HeaderItem key={label} label={label ?? ""} value={value} />
        ))}
      </div>
    </section>
  );
}

function HeaderItem({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="min-h-16 bg-gray-50 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-gray-800">{value || "-"}</p>
    </div>
  );
}

function formatHeaderDate(value?: string | null) {
  if (!value) return null;
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("pt-BR");
}

function formatHeaderDateTime(value?: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}
