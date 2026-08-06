import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import {
  validatePerformanceAnswers,
  type PerformanceQuestion,
} from "@/components/PerformanceReviewManager";

type FormData = {
  ok: true;
  reviewName: string;
  reviewType?: "experience" | "performance";
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
  const [stepIndex, setStepIndex] = useState(0);
  const hydratedRef = useRef(false);
  const steps = useMemo(() => buildPerformanceSteps(form?.questions ?? []), [form?.questions]);
  const currentStep = steps[stepIndex] ?? steps[0];
  const answeredCount = useMemo(
    () =>
      (form?.questions ?? []).filter(
        (question) => (question.active ?? true) && answers[question.id]?.trim(),
      ).length,
    [answers, form?.questions],
  );
  const totalQuestions = useMemo(
    () => (form?.questions ?? []).filter((question) => question.active ?? true).length,
    [form?.questions],
  );
  const progressPercent = totalQuestions ? Math.round((answeredCount / totalQuestions) * 100) : 0;

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
        setStepIndex(0);
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

  const validateStep = (questions: PerformanceQuestion[]) => {
    const validation = validatePerformanceAnswers(questions, answers, form?.participantType);
    if (validation) {
      setErrorMsg(validation);
      return false;
    }
    setErrorMsg("");
    return true;
  };

  const goNext = () => {
    if (!currentStep || !validateStep(currentStep.questions)) return;
    setStepIndex((current) => Math.min(current + 1, steps.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goBack = () => {
    setErrorMsg("");
    setStepIndex((current) => Math.max(current - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-[#042558]/5 px-4 pb-28 pt-12">
      <div className="mx-auto max-w-3xl overflow-hidden rounded-xl bg-white shadow-lg shadow-[#042558]/10">
        <div className="bg-[#042558] px-8 py-6">
          <p className="text-xs font-medium uppercase tracking-wider text-white/60">
            {reviewTypeTitle(form?.reviewType)}
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
              {currentStep?.kind === "intro" && (
                <SectionStep
                  title={currentStep.title}
                  questions={currentStep.questions}
                  participantType={form.participantType}
                  answers={answers}
                  onChange={setAnswers}
                />
              )}
              {currentStep?.kind === "section" && (
                <SectionStep
                  title={currentStep.title}
                  questions={currentStep.questions}
                  participantType={form.participantType}
                  answers={answers}
                  onChange={setAnswers}
                />
              )}
              {currentStep?.kind === "activity" && (
                <ActivityStep
                  title={currentStep.title}
                  index={currentStep.activityIndex}
                  total={steps.filter((step) => step.kind === "activity").length}
                  questions={currentStep.questions}
                  participantType={form.participantType}
                  answers={answers}
                  onChange={setAnswers}
                />
              )}
              {errorMsg && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                  {errorMsg}
                </p>
              )}
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={goBack}
                  disabled={stepIndex === 0 || state === "submitting"}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-5 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Voltar
                </button>
                {stepIndex < steps.length - 1 ? (
                  <button
                    type="button"
                    onClick={goNext}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#042558] px-6 py-3 text-sm font-medium text-white hover:bg-[#042558]/90"
                  >
                    Avançar
                    <ArrowRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={state === "submitting"}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#042558] px-6 py-3 text-sm font-medium text-white hover:bg-[#042558]/90 disabled:opacity-50"
                  >
                    {state === "submitting" ? "Enviando..." : "Enviar respostas"}
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
      {(state === "ready" || state === "submitting") && form && (
        <div className="fixed inset-x-0 bottom-0 border-t border-gray-200 bg-white/95 px-4 py-3 shadow-[0_-8px_24px_rgba(4,37,88,0.08)] backdrop-blur">
          <div className="mx-auto max-w-3xl">
            <div className="mb-2 flex items-center justify-between text-xs font-medium text-gray-500">
              <span>
                {answeredCount} de {totalQuestions} perguntas respondidas
              </span>
              <span>{progressPercent}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-[#042558] transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type PerformanceStep =
  | { kind: "intro"; title: string; questions: PerformanceQuestion[] }
  | { kind: "section"; title: string; questions: PerformanceQuestion[] }
  | {
      kind: "activity";
      title: string;
      activityIndex: number;
      questions: PerformanceQuestion[];
    };

function buildPerformanceSteps(questions: PerformanceQuestion[]): PerformanceStep[] {
  const activeQuestions = questions.filter((question) => question.active ?? true);
  const introQuestions = activeQuestions.filter((question) => !question.dynamicSource);
  const activityGroups: PerformanceStep[] = [];
  const groupMap = new Map<string, PerformanceQuestion[]>();

  activeQuestions.filter(isActivityQuestion).forEach((question) => {
    const key = `${question.sectionTitle ?? ""}:${question.groupId}`;
    groupMap.set(key, [...(groupMap.get(key) ?? []), question]);
  });

  Array.from(groupMap.values()).forEach((groupQuestions, index) => {
    activityGroups.push({
      kind: "activity",
      title: displayActivityTitle(groupQuestions[0], index),
      activityIndex: index + 1,
      questions: groupQuestions,
    });
  });

  const dynamicSections: Array<{
    source: NonNullable<PerformanceQuestion["dynamicSource"]>;
    title: string;
  }> = [
    { source: "indicators", title: "Indicadores" },
    { source: "culture_skills", title: "Habilidade cultural" },
    { source: "role_skills", title: "Habilidade específica do cargo" },
    { source: "behavior", title: "Postura e comportamento" },
  ];

  const sectionSteps = dynamicSections
    .map(({ source, title }) => ({
      kind: "section" as const,
      title,
      questions: activeQuestions.filter((question) => question.dynamicSource === source),
    }))
    .filter((step) => step.questions.length > 0);

  return [
    {
      kind: "intro",
      title: "Instrução e experiência",
      questions: introQuestions,
    },
    ...activityGroups,
    ...sectionSteps,
  ];
}

function isActivityQuestion(question: PerformanceQuestion) {
  return question.dynamicSource === "activities" && Boolean(question.groupId);
}

function displayActivityTitle(question: PerformanceQuestion | undefined, index: number) {
  const title = question?.groupTitle?.trim();
  if (title && !isInternalOptionValue(title)) return title;
  return `Atividade ${index + 1}`;
}

function normalizeLookup(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function isInternalOptionValue(value: string) {
  const normalized = normalizeLookup(value);
  return (
    /^(sim|nao|não)_\d+$/.test(normalized) ||
    /^[a-z0-9_-]+_\d{8,}$/.test(normalized) ||
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(normalized)
  );
}

function displayQuestionLabel(
  question: PerformanceQuestion,
  participantType?: FormData["participantType"],
) {
  return participantType === "leader" && question.leaderLabel?.trim()
    ? question.leaderLabel
    : question.label;
}

function questionOptions(
  question: PerformanceQuestion,
  participantType?: FormData["participantType"],
) {
  return participantType === "leader" && question.leaderOptions?.length
    ? question.leaderOptions
    : (question.options ?? []);
}

type QuestionBlock =
  | { kind: "question"; id: string; question: PerformanceQuestion }
  | {
      kind: "group";
      id: string;
      title: string;
      description?: string;
      questions: PerformanceQuestion[];
    };

function buildQuestionBlocks(questions: PerformanceQuestion[]) {
  const blocks: QuestionBlock[] = [];
  questions.forEach((question) => {
    if (!question.groupId) {
      blocks.push({ kind: "question", id: question.id, question });
      return;
    }
    const groupId = `${question.sectionTitle ?? ""}:${question.groupId}`;
    const existing = blocks.find(
      (block): block is Extract<QuestionBlock, { kind: "group" }> =>
        block.kind === "group" && block.id === groupId,
    );
    if (existing) {
      existing.questions.push(question);
      if (!existing.description && question.groupDescription?.trim()) {
        existing.description = question.groupDescription.trim();
      }
      return;
    }
    blocks.push({
      kind: "group",
      id: groupId,
      title: displayGroupTitle(question, blocks.length),
      description: question.groupDescription?.trim() || undefined,
      questions: [question],
    });
  });
  return blocks;
}

function displayGroupTitle(question: PerformanceQuestion | undefined, index: number) {
  const title = question?.groupTitle?.trim();
  if (title && !isInternalOptionValue(title)) return title;
  const sourceLabel: Record<string, string> = {
    activities: "Atividade",
    indicators: "Indicador",
    culture_skills: "Habilidade cultural",
    role_skills: "Habilidade do cargo",
    behavior: "Postura e comportamento",
  };
  const suffix = question?.groupId?.match(/_(\d+)$/)?.[1] ?? String(index + 1);
  return `${sourceLabel[question?.dynamicSource ?? ""] ?? "Item"} ${suffix}`;
}

function SectionStep({
  title,
  questions,
  participantType,
  answers,
  onChange,
}: {
  title: string;
  questions: PerformanceQuestion[];
  participantType: FormData["participantType"];
  answers: Record<string, string>;
  onChange: (answers: Record<string, string>) => void;
}) {
  const blocks = buildQuestionBlocks(questions);
  return (
    <section className="space-y-4">
      <div className="border-b border-gray-200 pb-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-[#042558]">{title}</h2>
      </div>
      {questions.length === 0 ? (
        <p className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
          Clique em avançar para continuar a avaliação. 
        </p>
      ) : (
        blocks.map((block) =>
          block.kind === "group" ? (
            <div key={block.id} className="rounded-xl border border-gray-200 bg-gray-50/60 p-4">
              <p className="mb-3 whitespace-pre-wrap text-sm font-semibold text-gray-800">
                {block.title}
              </p>
              {block.description && (
                <p className="mb-4 whitespace-pre-wrap rounded-lg border border-[#042558]/10 bg-white px-3 py-2 text-sm leading-relaxed text-gray-600">
                  {block.description}
                </p>
              )}
              <div className="grid gap-3 md:grid-cols-2">
                {block.questions.map((question) => (
                  <QuestionField
                    key={question.id}
                    question={question}
                    participantType={participantType}
                    value={answers[question.id] ?? ""}
                    onChange={(value) => onChange({ ...answers, [question.id]: value })}
                    unframed
                  />
                ))}
              </div>
            </div>
          ) : (
            <QuestionField
              key={block.id}
              question={block.question}
              participantType={participantType}
              value={answers[block.question.id] ?? ""}
              onChange={(value) => onChange({ ...answers, [block.question.id]: value })}
            />
          ),
        )
      )}
    </section>
  );
}

function ActivityStep({
  title,
  index,
  total,
  questions,
  participantType,
  answers,
  onChange,
}: {
  title: string;
  index: number;
  total: number;
  questions: PerformanceQuestion[];
  participantType: FormData["participantType"];
  answers: Record<string, string>;
  onChange: (answers: Record<string, string>) => void;
}) {
  return (
    <section className="space-y-6">
      <div className="text-center">
        <p className="text-xs font-bold uppercase tracking-wide text-[#042558]/60">
          Atividade {index} de {total}
        </p>
        <h2 className="mx-auto mt-3 max-w-2xl whitespace-pre-wrap text-lg font-medium leading-relaxed text-gray-800">
          {title}
        </h2>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {questions.map((question) => (
          <QuestionField
            key={question.id}
            question={question}
            participantType={participantType}
            value={answers[question.id] ?? ""}
            onChange={(value) => onChange({ ...answers, [question.id]: value })}
            compact
          />
        ))}
      </div>
    </section>
  );
}

function QuestionField({
  question,
  participantType,
  value,
  onChange,
  compact = false,
  unframed = false,
}: {
  question: PerformanceQuestion;
  participantType: FormData["participantType"];
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
  unframed?: boolean;
}) {
  const content = (
    <>
      <span
        className={`mb-2 block ${
          compact
            ? "text-xs font-semibold uppercase tracking-wide text-gray-600"
            : "text-sm font-semibold text-gray-700"
        }`}
      >
        {displayQuestionLabel(question, participantType)}{" "}
        {question.required && <span className="text-red-500">*</span>}
      </span>
      {question.helpText && !compact && (
        <span className="mb-2 block text-xs text-gray-400">{question.helpText}</span>
      )}
      <QuestionInput
        question={question}
        participantType={participantType}
        value={value}
        onChange={onChange}
      />
    </>
  );
  if (unframed) return <label className="block">{content}</label>;
  return (
    <label className="block rounded-xl border border-gray-200 bg-gray-50/60 p-4">{content}</label>
  );
}

function QuestionInput({
  question,
  participantType,
  value,
  onChange,
}: {
  question: PerformanceQuestion;
  participantType: FormData["participantType"];
  value: string;
  onChange: (value: string) => void;
}) {
  const inputClass =
    "w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700 outline-none transition-all focus:border-[#042558] focus:ring-2 focus:ring-[#042558]/20";
  if (question.type === "select") {
    return (
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputClass}
      >
        <option value="">Selecione uma opção</option>
        {questionOptions(question, participantType).map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }
  if (question.type === "textarea") {
    return (
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        className={`${inputClass} resize-y`}
      />
    );
  }
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={inputClass}
    />
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
        <HeaderItem
          label="Data de Envio da Avaliação"
          value={formatHeaderDateTime(header.sentAt)}
        />
        <HeaderItem
          label="Data Máxima de preenchimento"
          value={formatHeaderDateTime(header.expiresAt)}
        />
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

function reviewTypeTitle(reviewType?: FormData["reviewType"]) {
  return reviewType === "experience" ? "Avaliação de Experiência" : "Avaliação de Desempenho";
}
