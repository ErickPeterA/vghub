import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  History,
  ArrowLeft,
  Clock,
  Maximize2,
  MessageSquare,
  Plus,
  RotateCcw,
  Save,
  Send,
  Settings,
  SplitSquareVertical,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";

type FieldType = "text" | "textarea" | "select";
type ParticipantType = "collaborator" | "leader";
type ParticipantStatus = "not_sent" | "sent" | "accessed" | "in_progress" | "answered";
type ReviewStatus = "draft" | "waiting_responses" | "ready_for_comparison" | "finalized";

export type PerformanceQuestion = {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  active?: boolean;
  options?: string[];
  helpText?: string;
  source?: "activity" | "config";
};

type PositionRow = { id: string; nome: string; parent_id: string | null };
type DcRow = {
  id: string;
  project_id: string;
  organization_position_id: string | null;
  cargo: string | null;
  superior_imediato: string | null;
  atividades: Array<Record<string, unknown>> | null;
  [key: string]: unknown;
};
type PerfEmployeeRow = {
  id: string;
  project_id: string;
  position_id: string;
  area_id: string | null;
  sector_id: string | null;
  superior_imediato_id: string | null;
  nome: string;
  admission_date: string;
  last_performance_review_date: string | null;
};
type ConfigRow = {
  id: string;
  project_id: string;
  name: string | null;
  period_days: number | null;
  questions_schema: PerformanceQuestion[];
  is_active: boolean;
};
type ParticipantRow = {
  id: string;
  review_id: string;
  participant_type: ParticipantType;
  token: string;
  status: ParticipantStatus;
  expires_at: string;
  response_answers: Record<string, string>;
  submitted_at: string | null;
};
type ReviewRow = {
  id: string;
  project_id: string;
  config_id: string | null;
  employee_id: string | null;
  name: string;
  employee_position_id: string;
  leader_position_id: string;
  job_description_id: string;
  employee_name: string;
  leader_name: string;
  job_title: string;
  period_name: string | null;
  period_days: number | null;
  due_date: string | null;
  activities_snapshot: PerformanceQuestion[];
  questions_snapshot: PerformanceQuestion[];
  status: ReviewStatus;
  finalized_by: string | null;
  finalized_at: string | null;
  created_at: string;
};
type CommentRow = {
  id: string;
  question_key: string;
  author_id: string;
  content: string;
  created_at: string;
};
type HistoryRow = {
  id: string;
  participant_id: string;
  question_key: string;
  previous_answer: string | null;
  new_answer: string | null;
  changed_by: string | null;
  changed_at: string;
};

const DEFAULT_PERFORMANCE_QUESTIONS: PerformanceQuestion[] = [
  {
    id: "qualidade_entrega",
    label: "Qualidade das entregas",
    type: "select",
    required: true,
    active: true,
    options: ["Abaixo do esperado", "Dentro do esperado", "Acima do esperado"],
  },
  {
    id: "cumprimento_prazos",
    label: "Cumprimento de prazos",
    type: "select",
    required: true,
    active: true,
    options: ["Abaixo do esperado", "Dentro do esperado", "Acima do esperado"],
  },
  {
    id: "comunicacao",
    label: "Comunicação e colaboração",
    type: "select",
    required: true,
    active: true,
    options: ["Abaixo do esperado", "Dentro do esperado", "Acima do esperado"],
  },
  {
    id: "pontos_fortes",
    label: "Pontos fortes observados",
    type: "textarea",
    required: false,
    active: true,
  },
  {
    id: "pontos_desenvolver",
    label: "Pontos a desenvolver",
    type: "textarea",
    required: false,
    active: true,
  },
];

const ACTIVITY_SCALE = [
  "Não realiza",
  "Em desenvolvimento",
  "Realiza com apoio",
  "Realiza com autonomia",
  "Referência para o time",
];
const STATUS_LABEL: Record<ParticipantStatus, string> = {
  not_sent: "Não enviado",
  sent: "Enviado",
  accessed: "Acessado",
  in_progress: "Em preenchimento",
  answered: "Respondido",
};
const REVIEW_STATUS_LABEL: Record<ReviewStatus, string> = {
  draft: "Rascunho",
  waiting_responses: "Aguardando respostas",
  ready_for_comparison: "Pronta para comparação",
  finalized: "Finalizada",
};
const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
const inputClass =
  "w-full rounded-lg border border-[#042558]/20 bg-white/70 px-3 py-2 text-sm text-[#042558] outline-none focus:border-[#042558] focus:ring-2 focus:ring-[#042558]/20";

export function PerformanceReviewManager({ projectId }: { projectId: string }) {
  const { user, isAdmin } = useCurrentUser();
  const [tab, setTab] = useState<"reviews" | "config">("reviews");
  const [canManage, setCanManage] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      setCanManage(true);
      return;
    }
    if (!user) {
      setCanManage(false);
      return;
    }
    let cancelled = false;
    supabase
      .from("project_members")
      .select("role")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setCanManage(data?.role === "gp" || data?.role === "admin");
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin, projectId, user]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#042558]/5 via-white to-[#042558]/5 px-6 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 rounded-2xl border border-[#042558]/10 bg-white/80 p-6 shadow-sm backdrop-blur-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#042558]/50">
            Avaliação de Desempenho
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#042558]">
            Avaliação em dupla
          </h1>
          <p className="mt-1 text-sm text-[#042558]/60">
            Crie autoavaliações e avaliações do líder vinculadas à descrição de cargo.
          </p>
        </div>

        <div className="mb-8 border-b border-[#042558]/10">
          <div className="flex gap-8">
            <TabButton active={tab === "reviews"} onClick={() => setTab("reviews")}>
              Avaliações
            </TabButton>
            {canManage && (
              <TabButton active={tab === "config"} onClick={() => setTab("config")}>
                Modelos
              </TabButton>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-[#042558]/10 bg-white/60 p-6 shadow-sm backdrop-blur-sm">
          {!canManage ? (
            <div className="rounded-xl border border-dashed border-[#042558]/20 p-8 text-center text-sm text-[#042558]/50">
              Apenas GP e administradores podem criar e comparar avaliações de desempenho.
            </div>
          ) : tab === "config" ? (
            <PerformancePeriodConfigPanel projectId={projectId} />
          ) : (
            <PerformanceReviewsPanel projectId={projectId} />
          )}
        </div>
      </div>
    </main>
  );
}

export function PerformanceComparisonPage({
  projectId,
  reviewId,
}: {
  projectId: string;
  reviewId: string;
}) {
  const { user, isAdmin } = useCurrentUser();
  const [review, setReview] = useState<ReviewRow | null>(null);
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [authors, setAuthors] = useState<Record<string, string>>({});
  const [canManage, setCanManage] = useState(false);
  const [mobileSide, setMobileSide] = useState<ParticipantType>("collaborator");

  const load = useCallback(async () => {
    const [{ data: rev }, { data: parts }, { data: comm }, { data: hist }] = await Promise.all([
      supabase
        .from("performance_reviews")
        .select("*")
        .eq("project_id", projectId)
        .eq("id", reviewId)
        .maybeSingle(),
      supabase.from("performance_review_participants").select("*").eq("review_id", reviewId),
      supabase
        .from("performance_review_comments")
        .select("*")
        .eq("review_id", reviewId)
        .order("created_at", { ascending: true }),
      supabase
        .from("performance_answer_history")
        .select("*")
        .eq("review_id", reviewId)
        .order("changed_at", { ascending: false }),
    ]);
    setReview((rev as ReviewRow | null) ?? null);
    setParticipants((parts ?? []) as ParticipantRow[]);
    setComments((comm ?? []) as CommentRow[]);
    setHistory((hist ?? []) as HistoryRow[]);
  }, [projectId, reviewId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (isAdmin) {
      setCanManage(true);
      return;
    }
    if (!user) return;
    void supabase
      .from("project_members")
      .select("role")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setCanManage(data?.role === "gp" || data?.role === "admin");
      });
  }, [isAdmin, projectId, user]);

  useEffect(() => {
    const ids = Array.from(
      new Set([
        ...comments.map((c) => c.author_id),
        ...(history.map((h) => h.changed_by).filter(Boolean) as string[]),
      ]),
    );
    if (!ids.length) return;
    void supabase
      .from("profiles")
      .select("id,nome")
      .in("id", ids)
      .then(({ data }) => {
        const next: Record<string, string> = {};
        (data ?? []).forEach((p) => {
          next[p.id] = p.nome;
        });
        setAuthors(next);
      });
  }, [comments, history]);

  if (!review) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Carregando avaliação...
      </div>
    );
  }

  const collaborator = participants.find((p) => p.participant_type === "collaborator") ?? null;
  const leader = participants.find((p) => p.participant_type === "leader") ?? null;
  const questions = allReviewQuestions(review);
  const locked = review.status === "finalized";

  const addComment = async (questionKey: string, content: string) => {
    if (!user || locked) return;
    const { error } = await supabase.from("performance_review_comments").insert({
      review_id: review.id,
      question_key: questionKey,
      author_id: user.id,
      content,
    });
    if (error) return toast.error(error.message);
    await load();
  };

  const updateAnswer = async (
    participant: ParticipantRow,
    questionKey: string,
    nextAnswer: string,
  ) => {
    if (!canManage || locked) return;
    const current = participant.response_answers?.[questionKey] ?? "";
    if (current === nextAnswer) return;
    if (!confirm("Alterar esta resposta? O valor anterior será mantido no histórico.")) return;
    const nextAnswers = { ...(participant.response_answers ?? {}), [questionKey]: nextAnswer };
    const { error } = await supabase
      .from("performance_review_participants")
      .update({ response_answers: nextAnswers })
      .eq("id", participant.id);
    if (error) return toast.error(error.message);
    await supabase.from("performance_answer_history").insert({
      participant_id: participant.id,
      review_id: review.id,
      question_key: questionKey,
      previous_answer: current,
      new_answer: nextAnswer,
      changed_by: user?.id ?? null,
    });
    toast.success("Resposta alterada");
    await load();
  };

  const finalize = async () => {
    if (
      !collaborator ||
      !leader ||
      collaborator.status !== "answered" ||
      leader.status !== "answered"
    ) {
      toast.error("A avaliação só pode ser finalizada depois das duas respostas.");
      return;
    }
    const { error } = await supabase
      .from("performance_reviews")
      .update({
        status: "finalized",
        finalized_by: user?.id ?? null,
        finalized_at: new Date().toISOString(),
      })
      .eq("id", review.id);
    if (error) return toast.error(error.message);
    toast.success("Avaliação finalizada");
    await load();
  };

  const reopen = async () => {
    if (!canManage || !confirm("Reabrir esta avaliação para alterações?")) return;
    const { error } = await supabase
      .from("performance_reviews")
      .update({
        status: "ready_for_comparison",
        reopened_by: user?.id ?? null,
        reopened_at: new Date().toISOString(),
        finalized_by: null,
        finalized_at: null,
      })
      .eq("id", review.id);
    if (error) return toast.error(error.message);
    toast.success("Avaliação reaberta");
    await load();
  };

  return (
    <main className="min-h-screen bg-white text-[#042558]">
      <div className="sticky top-0 z-20 border-b border-[#042558]/10 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#042558]/50">
              Comparação de avaliação
            </p>
            <h1 className="text-xl font-bold">{review.name}</h1>
            <p className="text-sm text-[#042558]/60">
              {review.employee_name} · {review.job_title} · Líder: {review.leader_name}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => document.documentElement.requestFullscreen?.()}
              className="inline-flex items-center gap-2 rounded-lg border border-[#042558]/20 px-3 py-2 text-sm hover:bg-[#042558]/5"
            >
              <Maximize2 className="h-4 w-4" /> Tela cheia
            </button>
            {review.status === "finalized" ? (
              <button
                onClick={reopen}
                className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800"
              >
                <RotateCcw className="h-4 w-4" /> Reabrir
              </button>
            ) : (
              <button
                onClick={finalize}
                className="inline-flex items-center gap-2 rounded-lg bg-[#042558] px-3 py-2 text-sm font-medium text-white"
              >
                <CheckCircle2 className="h-4 w-4" /> Finalizar avaliação
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-4">
        <div className="mb-4 flex rounded-lg border border-[#042558]/15 p-1 md:hidden">
          <button
            onClick={() => setMobileSide("collaborator")}
            className={`flex-1 rounded-md px-3 py-2 text-sm ${mobileSide === "collaborator" ? "bg-[#042558] text-white" : "text-[#042558]/60"}`}
          >
            Colaborador
          </button>
          <button
            onClick={() => setMobileSide("leader")}
            className={`flex-1 rounded-md px-3 py-2 text-sm ${mobileSide === "leader" ? "bg-[#042558] text-white" : "text-[#042558]/60"}`}
          >
            Líder
          </button>
        </div>

        <div className="mb-4 rounded-xl border border-[#042558]/10 bg-[#042558]/5 p-4 text-sm">
          <span className="font-semibold">Modo de apresentação:</span> respostas alinhadas lado a
          lado, comentários por pergunta e histórico disponível quando houver alteração.
        </div>

        <div className="space-y-4">
          {questions.map((question) => {
            const leftAnswer = collaborator?.response_answers?.[question.id] ?? "";
            const rightAnswer = leader?.response_answers?.[question.id] ?? "";
            const different =
              question.type === "select" && leftAnswer && rightAnswer && leftAnswer !== rightAnswer;
            return (
              <section
                key={question.id}
                className={`rounded-xl border p-4 ${different ? "border-amber-300 bg-amber-50/70" : "border-[#042558]/10 bg-white"}`}
              >
                <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#042558]/50">
                      {question.source === "activity"
                        ? "Atividade da descrição de cargo"
                        : "Pergunta"}
                    </p>
                    <h2 className="text-base font-semibold">{question.label}</h2>
                  </div>
                  <CommentBox
                    questionKey={question.id}
                    comments={comments.filter((c) => c.question_key === question.id)}
                    authors={authors}
                    disabled={locked}
                    onAdd={addComment}
                  />
                </div>
                <div className="hidden grid-cols-[1fr_1px_1fr] gap-4 md:grid">
                  <AnswerCell
                    title="Colaborador"
                    participant={collaborator}
                    question={question}
                    canEdit={canManage && !locked}
                    onChange={updateAnswer}
                  />
                  <div className="bg-[#042558]/15" />
                  <AnswerCell
                    title="Líder"
                    participant={leader}
                    question={question}
                    canEdit={canManage && !locked}
                    onChange={updateAnswer}
                  />
                </div>
                <div className="md:hidden">
                  <AnswerCell
                    title={mobileSide === "collaborator" ? "Colaborador" : "Líder"}
                    participant={mobileSide === "collaborator" ? collaborator : leader}
                    question={question}
                    canEdit={canManage && !locked}
                    onChange={updateAnswer}
                  />
                </div>
                <HistoryList
                  history={history.filter((h) => h.question_key === question.id)}
                  authors={authors}
                />
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}

function PerformanceConfigPanel({ projectId }: { projectId: string }) {
  const [configId, setConfigId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<PerformanceQuestion[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [newLabel, setNewLabel] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("performance_review_configs")
      .select("*")
      .eq("project_id", projectId)
      .maybeSingle();
    if (data) {
      const cfg = data as ConfigRow;
      setConfigId(cfg.id);
      setQuestions((cfg.questions_schema ?? []).map((q) => ({ ...q, active: q.active ?? true })));
      setIsActive(cfg.is_active);
    } else {
      setConfigId(null);
      setQuestions(DEFAULT_PERFORMANCE_QUESTIONS.map((q) => ({ ...q, id: `${q.id}_${uid()}` })));
      setIsActive(true);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const payload = {
      project_id: projectId,
      questions_schema: questions,
      is_active: isActive,
      created_by: userData.user?.id ?? null,
    };
    const { error } = configId
      ? await supabase.from("performance_review_configs").update(payload).eq("id", configId)
      : await supabase.from("performance_review_configs").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Configuração salva");
    await load();
  };

  const addQuestion = () => {
    const label = newLabel.trim();
    if (!label) return;
    setQuestions((current) => [
      ...current,
      { id: uid(), label, type: "text", required: false, active: true, source: "config" },
    ]);
    setNewLabel("");
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#042558]">Perguntas da avaliação</h2>
          <p className="text-sm text-[#042558]/60">
            As atividades da descrição de cargo entram automaticamente como itens de avaliação.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="flex items-center gap-2 rounded-lg border border-[#042558]/20 px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />{" "}
            Ativo
          </label>
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-[#042558] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            <Save className="h-4 w-4" /> {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addQuestion())}
          placeholder="Nova pergunta"
          className={inputClass}
        />
        <button
          onClick={addQuestion}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[#042558] px-4 py-2 text-sm font-medium text-white"
        >
          <Plus className="h-4 w-4" /> Criar
        </button>
      </div>

      <div className="space-y-3">
        {questions.map((question) => (
          <div key={question.id} className="rounded-xl border border-[#042558]/10 bg-white/70 p-4">
            <div className="grid gap-3 md:grid-cols-[1fr_150px_auto]">
              <input
                value={question.label}
                onChange={(e) =>
                  setQuestions((current) =>
                    current.map((q) =>
                      q.id === question.id ? { ...q, label: e.target.value } : q,
                    ),
                  )
                }
                className={inputClass}
              />
              <select
                value={question.type}
                onChange={(e) =>
                  setQuestions((current) =>
                    current.map((q) =>
                      q.id === question.id ? { ...q, type: e.target.value as FieldType } : q,
                    ),
                  )
                }
                className={inputClass}
              >
                <option value="text">Texto</option>
                <option value="textarea">Texto longo</option>
                <option value="select">Seleção única</option>
              </select>
              <button
                onClick={() =>
                  setQuestions((current) => current.filter((q) => q.id !== question.id))
                }
                className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50"
              >
                Remover
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-sm text-[#042558]/60">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={question.required}
                  onChange={(e) =>
                    setQuestions((current) =>
                      current.map((q) =>
                        q.id === question.id ? { ...q, required: e.target.checked } : q,
                      ),
                    )
                  }
                />{" "}
                Obrigatório
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={question.active ?? true}
                  onChange={(e) =>
                    setQuestions((current) =>
                      current.map((q) =>
                        q.id === question.id ? { ...q, active: e.target.checked } : q,
                      ),
                    )
                  }
                />{" "}
                Ativo
              </label>
            </div>
            {question.type === "select" && (
              <SelectOptionsEditor
                options={question.options ?? []}
                onChange={(options) =>
                  setQuestions((current) =>
                    current.map((q) => (q.id === question.id ? { ...q, options } : q)),
                  )
                }
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function PerformancePeriodConfigPanel({ projectId }: { projectId: string }) {
  const { user } = useCurrentUser();
  const [configs, setConfigs] = useState<ConfigRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<PerformanceQuestion[]>([]);
  const [periodName, setPeriodName] = useState("");
  const [periodDays, setPeriodDays] = useState(30);
  const [isActive, setIsActive] = useState(true);
  const [newLabel, setNewLabel] = useState("");
  const [newPeriodName, setNewPeriodName] = useState("");
  const [newPeriodDays, setNewPeriodDays] = useState("");
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);

  const hydrate = (config: ConfigRow) => {
    const normalized = normalizeConfigRow(config);
    setPeriodName(normalized.name ?? periodLabel(normalized));
    setPeriodDays(normalized.period_days ?? 30);
    setQuestions(
      (normalized.questions_schema ?? []).map((question) => ({
        ...question,
        active: question.active ?? true,
      })),
    );
    setIsActive(normalized.is_active);
  };

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("performance_review_configs")
      .select("*")
      .eq("project_id", projectId)
      .order("period_days", { ascending: true });
    if (error) {
      toast.error(error.message);
      return;
    }

    const rows = ((data ?? []) as ConfigRow[]).map(normalizeConfigRow);
    setConfigs(rows);
    const selected = rows.find((config) => config.id === selectedId) ?? null;
    if (selected) hydrate(selected);
    else setSelectedId(null);
  }, [projectId, selectedId]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedConfig = configs.find((config) => config.id === selectedId) ?? null;

  const selectConfig = (config: ConfigRow) => {
    setSelectedId(config.id);
    hydrate(config);
  };

  const createPeriod = async () => {
    const days = Number(newPeriodDays);
    if (!Number.isFinite(days) || days <= 0) return toast.error("Informe um periodo valido.");
    if (configs.some((config) => config.period_days === days)) {
      return toast.error(`Ja existe um modelo com ${days} dias. Remova ou edite o modelo existente.`);
    }
    const name = newPeriodName.trim() || `${days} dias`;
    setCreating(true);
    const { data, error } = await supabase
      .from("performance_review_configs")
      .insert({
        project_id: projectId,
        name,
        period_days: days,
        questions_schema: DEFAULT_PERFORMANCE_QUESTIONS.map((question) => ({
          ...question,
          id: `${question.id}_${uid()}`,
        })),
        is_active: true,
        created_by: user?.id ?? null,
      } as any)
      .select("*")
      .single();
    setCreating(false);
    if (error || !data) {
      const message = error?.message?.includes("performance_review_configs_project_period_unique")
        ? `Ja existe um modelo com ${days} dias. Remova ou edite o modelo existente.`
        : error?.message ?? "Nao foi possivel criar.";
      return toast.error(message);
    }
    toast.success("Modelo criado");
    setNewPeriodName("");
    setNewPeriodDays("");
    const created = normalizeConfigRow(data as ConfigRow);
    setConfigs((current) =>
      [...current, created].sort((a, b) => (a.period_days ?? 0) - (b.period_days ?? 0)),
    );
    setSelectedId(created.id);
    hydrate(created);
  };

  const save = async () => {
    if (!selectedConfig) return toast.error("Selecione um modelo.");
    const days = Number(periodDays);
    if (!periodName.trim()) return toast.error("Informe o nome do periodo.");
    if (!Number.isFinite(days) || days <= 0) return toast.error("Informe um periodo valido.");
    if (configs.some((config) => config.id !== selectedConfig.id && config.period_days === days)) {
      return toast.error(`Ja existe outro modelo com ${days} dias.`);
    }

    setSaving(true);
    const { error } = await supabase
      .from("performance_review_configs")
      .update({
        name: periodName.trim(),
        period_days: days,
        questions_schema: questions,
        is_active: isActive,
      } as any)
      .eq("id", selectedConfig.id)
      .eq("project_id", projectId);
    setSaving(false);
    if (error) {
      const message = error.message.includes("performance_review_configs_project_period_unique")
        ? `Ja existe outro modelo com ${days} dias.`
        : error.message;
      return toast.error(message);
    }
    toast.success("Modelo salvo");
    await load();
  };

  const deleteSelected = async () => {
    if (!selectedConfig) return;
    if (!confirm(`Remover o modelo "${periodLabel(selectedConfig)}"? As avaliacoes antigas continuam salvas.`)) return;
    const { error } = await supabase
      .from("performance_review_configs")
      .delete()
      .eq("id", selectedConfig.id)
      .eq("project_id", projectId);
    if (error) return toast.error(error.message);
    toast.success("Modelo removido");
    setSelectedId(null);
    setQuestions([]);
    await load();
  };

  const addQuestion = () => {
    const label = newLabel.trim();
    if (!label) return;
    setQuestions((current) => [
      ...current,
      { id: uid(), label, type: "text", required: false, active: true, source: "config" },
    ]);
    setNewLabel("");
  };

  return (
    <div className="space-y-5">
      {!selectedConfig && (
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-bold text-[#042558]">Modelos por periodo</h2>
          <p className="text-sm text-[#042558]/60">
            Cada bloco guarda as perguntas usadas em um periodo de avaliacao.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {configs.map((config) => {
            const active = config.id === selectedId;
            return (
              <button
                key={config.id}
                type="button"
                onClick={() => selectConfig(config)}
                className={`rounded-xl border p-4 text-left transition ${
                  active
                    ? "border-[#042558] bg-[#042558] text-white shadow-lg shadow-[#042558]/20"
                    : "border-[#042558]/10 bg-white/80 text-[#042558] hover:border-[#042558]/35 hover:shadow-md"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className={`text-xs font-semibold uppercase tracking-wider ${active ? "text-white/60" : "text-[#042558]/45"}`}>
                      Periodo
                    </p>
                    <h3 className="mt-1 text-lg font-semibold">{periodLabel(config)}</h3>
                  </div>
                  <Clock className={`h-5 w-5 ${active ? "text-white/70" : "text-[#042558]/35"}`} />
                </div>
                <p className={`mt-3 text-sm ${active ? "text-white/70" : "text-[#042558]/55"}`}>
                  {(config.questions_schema ?? []).filter((question) => question.active ?? true).length} pergunta(s) ativa(s)
                </p>
                <span className={`mt-3 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${config.is_active ? active ? "bg-white/15 text-white" : "bg-emerald-50 text-emerald-700" : active ? "bg-white/15 text-white/70" : "bg-[#042558]/5 text-[#042558]/45"}`}>
                  {config.is_active ? "Ativo" : "Inativo"}
                </span>
              </button>
            );
          })}

          <div className="rounded-xl border border-dashed border-[#042558]/20 bg-white/60 p-4">
            <p className="text-sm font-semibold text-[#042558]">Novo modelo</p>
            <div className="mt-3 grid gap-2">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-[#042558]/70">Nome do modelo</span>
                <input
                  value={newPeriodName}
                  onChange={(event) => setNewPeriodName(event.target.value)}
                  placeholder="Ex: 2 meses"
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-[#042558]/70">Quantos dias</span>
                <input
                  type="number"
                  min={1}
                  value={newPeriodDays}
                  onChange={(event) => setNewPeriodDays(event.target.value)}
                  placeholder="Ex: 60"
                  className={inputClass}
                />
              </label>
              <button
                type="button"
                onClick={createPeriod}
                disabled={creating}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#042558] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                <Plus className="h-4 w-4" /> {creating ? "Criando..." : "Adicionar periodo"}
              </button>
            </div>
          </div>
        </div>
      </section>
      )}

      {selectedConfig ? (
        <section className="rounded-2xl border border-[#042558]/10 bg-white/70 p-5">
          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-[#042558]/55 transition hover:text-[#042558]"
              >
                <ArrowLeft className="h-4 w-4" /> Voltar para modelos
              </button>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#042558]/45">
                Configuracao do modelo
              </p>
              <h2 className="mt-1 text-xl font-bold text-[#042558]">{periodLabel(selectedConfig)}</h2>
              <p className="text-sm text-[#042558]/60">
                As atividades da descricao de cargo entram automaticamente como itens de avaliacao.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="flex items-center gap-2 rounded-lg border border-[#042558]/20 px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(event) => setIsActive(event.target.checked)}
                />
                Ativo
              </label>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-[#042558] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                <Save className="h-4 w-4" /> {saving ? "Salvando..." : "Salvar"}
              </button>
              <button
                type="button"
                onClick={deleteSelected}
                className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" /> Remover
              </button>
            </div>
          </div>

          <div className="mb-5 grid gap-3 md:grid-cols-[1fr_160px]">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[#042558]/70">Nome do periodo</span>
              <input
                value={periodName}
                onChange={(event) => setPeriodName(event.target.value)}
                className={inputClass}
                placeholder="Ex: 30 dias de experiencia"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[#042558]/70">Quantos dias</span>
              <input
                type="number"
                min={1}
                value={periodDays}
                onChange={(event) => setPeriodDays(Number(event.target.value))}
                className={inputClass}
              />
            </label>
          </div>

          <div className="mb-5 flex gap-2">
            <input
              value={newLabel}
              onChange={(event) => setNewLabel(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && (event.preventDefault(), addQuestion())}
              placeholder="Nova pergunta"
              className={inputClass}
            />
            <button
              type="button"
              onClick={addQuestion}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[#042558] px-4 py-2 text-sm font-medium text-white"
            >
              <Plus className="h-4 w-4" /> Criar
            </button>
          </div>

          <div className="space-y-3">
            {questions.map((question) => (
              <div key={question.id} className="rounded-xl border border-[#042558]/10 bg-white/70 p-4">
                <div className="grid gap-3 md:grid-cols-[1fr_150px_auto]">
                  <input
                    value={question.label}
                    onChange={(event) =>
                      setQuestions((current) =>
                        current.map((q) =>
                          q.id === question.id ? { ...q, label: event.target.value } : q,
                        ),
                      )
                    }
                    className={inputClass}
                  />
                  <select
                    value={question.type}
                    onChange={(event) =>
                      setQuestions((current) =>
                        current.map((q) =>
                          q.id === question.id ? { ...q, type: event.target.value as FieldType } : q,
                        ),
                      )
                    }
                    className={inputClass}
                  >
                    <option value="text">Texto</option>
                    <option value="textarea">Texto longo</option>
                    <option value="select">Selecao unica</option>
                  </select>
                  <button
                    type="button"
                    onClick={() =>
                      setQuestions((current) => current.filter((q) => q.id !== question.id))
                    }
                    className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50"
                  >
                    Remover
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-4 text-sm text-[#042558]/60">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={question.required}
                      onChange={(event) =>
                        setQuestions((current) =>
                          current.map((q) =>
                            q.id === question.id ? { ...q, required: event.target.checked } : q,
                          ),
                        )
                      }
                    />
                    Obrigatorio
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={question.active ?? true}
                      onChange={(event) =>
                        setQuestions((current) =>
                          current.map((q) =>
                            q.id === question.id ? { ...q, active: event.target.checked } : q,
                          ),
                        )
                      }
                    />
                    Ativo
                  </label>
                </div>
                {question.type === "select" && (
                  <SelectOptionsEditor
                    options={question.options ?? []}
                    onChange={(options) =>
                      setQuestions((current) =>
                        current.map((q) => (q.id === question.id ? { ...q, options } : q)),
                      )
                    }
                  />
                )}
              </div>
            ))}
          </div>
        </section>
      ) : configs.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-[#042558]/15 bg-white/60 p-8 text-center text-sm text-[#042558]/45">
          Crie um modelo de periodo para configurar as perguntas.
        </div>
      ) : null}
    </div>
  );
}

function normalizeConfigRow(config: ConfigRow): ConfigRow {
  return {
    ...config,
    name: config.name ?? "Padrao",
    period_days: config.period_days ?? 30,
    questions_schema: config.questions_schema ?? [],
    is_active: config.is_active ?? true,
  };
}

function periodLabel(config: ConfigRow) {
  const normalized = normalizeConfigRow(config);
  return normalized.name?.trim() || `${normalized.period_days} dias`;
}

function addDaysToDate(dateValue: string, days: number) {
  const date = new Date(`${dateValue}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatDateOnly(dateValue: string) {
  return new Date(`${dateValue}T00:00:00`).toLocaleDateString("pt-BR");
}

function SelectOptionsEditor({
  options,
  onChange,
}: {
  options: string[];
  onChange: (options: string[]) => void;
}) {
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [newOptionLabel, setNewOptionLabel] = useState("");

  const addOption = () => {
    const label = newOptionLabel.trim();
    if (!label) return;
    if (options.includes(label)) {
      toast.error("Esta opção já existe.");
      return;
    }
    onChange([...options, label]);
    setNewOptionLabel("");
  };

  const removeOption = (option: string) => {
    onChange(options.filter((current) => current !== option));
  };

  return (
    <div className="mt-4 border-t border-[#042558]/10 pt-4">
      <button
        type="button"
        onClick={() => setOptionsOpen((value) => !value)}
        className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-[#042558]/50 transition-colors hover:text-[#042558]"
      >
        Opções ({options.length})
        {optionsOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {optionsOpen && (
        <>
          <div className="mb-3 flex gap-2">
            <input
              value={newOptionLabel}
              onChange={(event) => setNewOptionLabel(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && (event.preventDefault(), addOption())}
              placeholder="Nova opção..."
              className={inputClass}
            />
            <button
              type="button"
              onClick={addOption}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#042558]/20 bg-white/60 px-3 py-2 text-sm font-medium text-[#042558] transition-all hover:bg-[#042558] hover:text-white hover:shadow-lg hover:shadow-[#042558]/20"
            >
              <Plus className="h-3.5 w-3.5" /> Adicionar
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {options.map((option) => (
              <span
                key={option}
                className="inline-flex items-center gap-2 rounded-full border border-[#042558]/20 bg-white/60 px-3 py-1 text-sm text-[#042558]"
              >
                {option}
                <button
                  type="button"
                  onClick={() => removeOption(option)}
                  aria-label="Excluir opção"
                  className="text-[#042558]/40 transition-colors hover:text-red-600"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function PerformanceReviewsPanel({ projectId }: { projectId: string }) {
  const { user } = useCurrentUser();
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [employees, setEmployees] = useState<PerfEmployeeRow[]>([]);
  const [descriptions, setDescriptions] = useState<DcRow[]>([]);
  const [configs, setConfigs] = useState<ConfigRow[]>([]);
  const [configId, setConfigId] = useState("");
  const [name, setName] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [leaderEmployeeId, setLeaderEmployeeId] = useState("");
  const [days, setDays] = useState(14);

  const load = useCallback(async () => {
    const [{ data: revs }, { data: parts }, { data: pos }, { data: emps }, { data: dcs }, { data: cfgs }] =
      await Promise.all([
        supabase
          .from("performance_reviews")
          .select("*")
          .eq("project_id", projectId)
          .order("created_at", { ascending: false }),
        supabase.from("performance_review_participants").select("*").eq("project_id", projectId),
        supabase
          .from("project_positions")
          .select("id,nome,parent_id")
          .eq("project_id", projectId)
          .eq("status", "active")
          .order("display_order"),
        (supabase as any)
          .from("project_employees")
          .select("id,project_id,position_id,area_id,sector_id,superior_imediato_id,nome,admission_date,last_performance_review_date")
          .eq("project_id", projectId)
          .order("nome"),
        supabase.from("descricoes_cargo").select("*").eq("project_id", projectId),
        supabase
          .from("performance_review_configs")
          .select("*")
          .eq("project_id", projectId)
          .eq("is_active", true)
          .order("period_days", { ascending: true }),
      ]);
    setReviews((revs ?? []) as ReviewRow[]);
    setParticipants((parts ?? []) as ParticipantRow[]);
    setPositions((pos ?? []) as PositionRow[]);
    setEmployees((emps ?? []) as PerfEmployeeRow[]);
    setDescriptions((dcs ?? []) as DcRow[]);
    const rows = ((cfgs ?? []) as ConfigRow[]).map(normalizeConfigRow);
    setConfigs(rows);
    setConfigId((current) => current || rows[0]?.id || "");
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedEmployee = employees.find((employee) => employee.id === employeeId) ?? null;
  const selectedLeader = employees.find((employee) => employee.id === leaderEmployeeId) ?? null;
  const employeePositionId = selectedEmployee?.position_id ?? "";
  const selectedDc =
    descriptions.find((dc) => dc.organization_position_id === employeePositionId) ?? null;
  const subordinateCountByLeader = employees.reduce((acc, employee) => {
    if (!employee.superior_imediato_id) return acc;
    acc.set(employee.superior_imediato_id, (acc.get(employee.superior_imediato_id) ?? 0) + 1);
    return acc;
  }, new Map<string, number>());
  const leaderEmployees = employees.filter((employee) => (subordinateCountByLeader.get(employee.id) ?? 0) > 0);
  const subordinateEmployees = leaderEmployeeId
    ? employees.filter((employee) => employee.superior_imediato_id === leaderEmployeeId)
    : [];
  const selectedEmployeeIsBelowLeader =
    !!selectedEmployee &&
    !!leaderEmployeeId &&
    selectedEmployee.superior_imediato_id === leaderEmployeeId;
  const selectedConfig = configs.find((config) => config.id === configId) ?? null;
  const expectedReviewDate =
    selectedEmployee && selectedConfig?.period_days
      ? addDaysToDate(selectedEmployee.admission_date, selectedConfig.period_days)
      : null;

  useEffect(() => {
    setEmployeeId("");
  }, [leaderEmployeeId]);

  const createReview = async () => {
    if (!name.trim()) return toast.error("Informe o nome da avaliação.");
    if (!selectedEmployee || !selectedLeader)
      return toast.error("Informe colaborador e líder.");
    if (!selectedEmployeeIsBelowLeader)
      return toast.error("Selecione um colaborador que responda diretamente para este lider.");
    if (!selectedDc)
      return toast.error("Este colaborador não possui descrição de cargo vinculada.");
    if (!selectedConfig || !selectedConfig.is_active)
      return toast.error("Selecione um modelo de periodo ativo antes de criar.");
    const employeePosition = positions.find((p) => p.id === employeePositionId);
    const leaderPosition = positions.find((p) => p.id === selectedLeader.position_id);
    if (!employeePosition || !leaderPosition) return toast.error("Colaborador ou líder inválido.");

    const activities = buildActivityQuestions(selectedDc);
    const questions = (selectedConfig.questions_schema ?? [])
      .filter((q) => q.active ?? true)
      .map((q) => ({ ...q, source: "config" as const }));
    const expires_at = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

    const { data: review, error } = await supabase
      .from("performance_reviews")
      .insert({
        project_id: projectId,
        config_id: selectedConfig.id,
        employee_id: selectedEmployee.id,
        name: name.trim(),
        employee_position_id: employeePositionId,
        leader_position_id: selectedLeader.position_id,
        job_description_id: selectedDc.id,
        employee_name: selectedEmployee.nome,
        leader_name: selectedLeader.nome,
        job_title: selectedDc.cargo || employeePosition.nome,
        period_name: periodLabel(selectedConfig),
        period_days: selectedConfig.period_days,
        due_date: expectedReviewDate,
        job_description_snapshot: selectedDc,
        activities_snapshot: activities,
        questions_snapshot: questions,
        created_by: user?.id ?? null,
      })
      .select("id")
      .single();
    if (error || !review) return toast.error(error?.message ?? "Não foi possível criar.");

    const { error: partErr } = await supabase.from("performance_review_participants").insert([
      { review_id: review.id, project_id: projectId, participant_type: "collaborator", expires_at },
      { review_id: review.id, project_id: projectId, participant_type: "leader", expires_at },
    ]);
    if (partErr) return toast.error(partErr.message);
    setName("");
    setEmployeeId("");
    setLeaderEmployeeId("");
    toast.success("Avaliação criada");
    await load();
  };

  const markSentAndCopy = async (participant: ParticipantRow) => {
    const url = `${window.location.origin}/avaliacao-desempenho/preencher/${participant.token}`;
    try {
      await navigator.clipboard.writeText(url);
      if (participant.status === "not_sent") {
        await supabase
          .from("performance_review_participants")
          .update({ status: "sent" })
          .eq("id", participant.id);
      }
      toast.success("Link copiado");
      await load();
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  };

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-[#042558]/10 bg-white/70 p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[#042558]">
          Nova avaliação de desempenho
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[#042558]/70">
              Nome da avaliação
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              placeholder="Ex: Avaliação semestral"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[#042558]/70">
              Modelo do periodo
            </span>
            <select
              value={configId}
              onChange={(e) => setConfigId(e.target.value)}
              className={inputClass}
            >
              <option value="">Selecione um modelo</option>
              {configs.map((config) => (
                <option key={config.id} value={config.id}>
                  {periodLabel(config)}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[#042558]/70">
              Lider avaliador
            </span>
            <select
              value={leaderEmployeeId}
              onChange={(e) => setLeaderEmployeeId(e.target.value)}
              className={inputClass}
            >
              <option value="">Selecione</option>
              {leaderEmployees.map((employee) => {
                const position = positions.find((item) => item.id === employee.position_id);
                const count = subordinateCountByLeader.get(employee.id) ?? 0;
                return (
                  <option key={employee.id} value={employee.id}>
                    {employee.nome} - {position?.nome ?? "sem cargo"} - {count} subordinado(s)
                  </option>
                );
              })}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[#042558]/70">
              Colaborador avaliado
            </span>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className={inputClass}
              disabled={!leaderEmployeeId}
            >
              <option value="">
                {leaderEmployeeId ? "Selecione" : "Selecione o lider primeiro"}
              </option>
              {subordinateEmployees.map((employee) => {
                const position = positions.find((item) => item.id === employee.position_id);
                const hasDescription = descriptions.some(
                  (dc) => dc.organization_position_id === employee.position_id,
                );
                return (
                  <option key={employee.id} value={employee.id} disabled={!hasDescription}>
                    {employee.nome} - {position?.nome ?? "sem cargo"}
                    {!hasDescription ? " - sem descricao de cargo" : ""}
                  </option>
                );
              })}
              {leaderEmployeeId && subordinateEmployees.length === 0 && (
                <option value="" disabled>
                  Nenhum funcionario cadastrado abaixo deste lider
                </option>
              )}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[#042558]/70">
              Validade dos links
            </span>
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className={inputClass}
            >
              <option value={7}>7 dias</option>
              <option value={14}>14 dias</option>
              <option value={30}>30 dias</option>
            </select>
          </label>
        </div>
        {employeePositionId && !selectedDc && (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Este colaborador não possui descrição de cargo vinculada.
          </p>
        )}
        {selectedEmployee && selectedConfig && expectedReviewDate && (
          <p className="mt-3 rounded-lg border border-[#042558]/10 bg-[#042558]/5 px-3 py-2 text-sm text-[#042558]/70">
            Data prevista: {formatDateOnly(expectedReviewDate)} ({periodLabel(selectedConfig)} apos admissao em {formatDateOnly(selectedEmployee.admission_date)}).
          </p>
        )}
        {selectedDc && (
          <p className="mt-3 text-sm text-[#042558]/60">
            Descrição vinculada: {selectedDc.cargo || "sem cargo"} ·{" "}
            {buildActivityQuestions(selectedDc).length} atividade(s) serão usadas como itens.
          </p>
        )}
        <button
          onClick={createReview}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#042558] px-4 py-2 text-sm font-medium text-white"
        >
          <Plus className="h-4 w-4" /> Nova avaliação de desempenho
        </button>
      </section>

      <section className="space-y-3">
        {reviews.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-[#042558]/15 p-8 text-center text-sm text-[#042558]/40">
            Nenhuma avaliação criada.
          </div>
        ) : (
          reviews.map((review) => {
            const ps = participants.filter((p) => p.review_id === review.id);
            const collaborator = ps.find((p) => p.participant_type === "collaborator");
            const leader = ps.find((p) => p.participant_type === "leader");
            return (
              <article
                key={review.id}
                className="rounded-xl border border-[#042558]/10 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h3 className="font-semibold text-[#042558]">{review.name}</h3>
                    <p className="mt-1 text-sm text-[#042558]/60">
                      {review.employee_name} · {review.job_title} · Líder: {review.leader_name}
                    </p>
                    {(review.period_name || review.due_date) && (
                      <p className="mt-1 text-xs text-[#042558]/45">
                        {review.period_name ?? "Periodo"} {review.due_date ? `- prevista para ${formatDateOnly(review.due_date)}` : ""}
                      </p>
                    )}
                    <span className="mt-2 inline-flex rounded-full bg-[#042558]/10 px-2 py-0.5 text-xs font-medium text-[#042558]">
                      {REVIEW_STATUS_LABEL[review.status]}
                    </span>
                  </div>
                  <a
                    href={`/projetos/${projectId}/avaliacao-desempenho/comparar/${review.id}`}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#042558] px-3 py-2 text-sm font-medium text-white"
                  >
                    <SplitSquareVertical className="h-4 w-4" /> Comparar avaliações
                  </a>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <ParticipantCard
                    title="Colaborador"
                    participant={collaborator}
                    onCopy={markSentAndCopy}
                  />
                  <ParticipantCard title="Líder" participant={leader} onCopy={markSentAndCopy} />
                </div>
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}

function ParticipantCard({
  title,
  participant,
  onCopy,
}: {
  title: string;
  participant?: ParticipantRow;
  onCopy: (participant: ParticipantRow) => void;
}) {
  return (
    <div className="rounded-lg border border-[#042558]/10 bg-[#042558]/5 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#042558]/50">
            {title}
          </p>
          <p className="text-sm font-medium text-[#042558]">
            {participant ? STATUS_LABEL[participant.status] : "Link não gerado"}
          </p>
        </div>
        {participant ? (
          <button
            onClick={() => onCopy(participant)}
            className="inline-flex items-center gap-2 rounded-lg border border-[#042558]/20 bg-white px-3 py-2 text-xs font-medium text-[#042558] hover:bg-[#042558]/5"
          >
            <Copy className="h-3.5 w-3.5" /> Enviar link
          </button>
        ) : (
          <span className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
            Recrie a avaliação
          </span>
        )}
      </div>
      {participant?.submitted_at && (
        <p className="mt-2 text-xs text-[#042558]/50">
          Respondido {new Date(participant.submitted_at).toLocaleString("pt-BR")}
        </p>
      )}
      {participant && (
        <p className="mt-2 break-all text-[11px] text-[#042558]/45">
          /avaliacao-desempenho/preencher/{participant.token}
        </p>
      )}
    </div>
  );
}

function AnswerCell({
  title,
  participant,
  question,
  canEdit,
  onChange,
}: {
  title: string;
  participant: ParticipantRow | null;
  question: PerformanceQuestion;
  canEdit: boolean;
  onChange: (participant: ParticipantRow, questionKey: string, nextAnswer: string) => void;
}) {
  const value = participant?.response_answers?.[question.id] ?? "";
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#042558]/50">
        {title}
      </p>
      {!participant || participant.status !== "answered" ? (
        <p className="rounded-lg bg-[#042558]/5 p-3 text-sm italic text-[#042558]/40">
          sem resposta
        </p>
      ) : canEdit ? (
        <QuestionInput
          question={question}
          value={value}
          onChange={(next) => onChange(participant, question.id, next)}
        />
      ) : (
        <p className="min-h-[42px] whitespace-pre-wrap rounded-lg bg-[#042558]/5 p-3 text-sm text-[#042558]">
          {value || <span className="italic text-[#042558]/40">sem resposta</span>}
        </p>
      )}
    </div>
  );
}

function QuestionInput({
  question,
  value,
  onChange,
}: {
  question: PerformanceQuestion;
  value: string;
  onChange: (value: string) => void;
}) {
  if (question.type === "select") {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
        <option value="">Selecione</option>
        {(question.options ?? []).map((option) => (
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
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        className={inputClass}
      />
    );
  }
  return <input value={value} onChange={(e) => onChange(e.target.value)} className={inputClass} />;
}

function CommentBox({
  questionKey,
  comments,
  authors,
  disabled,
  onAdd,
}: {
  questionKey: string;
  comments: CommentRow[];
  authors: Record<string, string>;
  disabled: boolean;
  onAdd: (questionKey: string, content: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center gap-1 rounded-lg border border-[#042558]/20 px-3 py-2 text-xs font-medium text-[#042558] hover:bg-[#042558]/5"
      >
        <MessageSquare className="h-3.5 w-3.5" /> Comentários{" "}
        {comments.length > 0 ? `(${comments.length})` : ""}
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-10 w-80 rounded-xl border border-[#042558]/10 bg-white p-3 shadow-xl">
          <div className="max-h-56 space-y-2 overflow-y-auto">
            {comments.length === 0 && (
              <p className="text-xs italic text-[#042558]/40">Sem comentários.</p>
            )}
            {comments.map((comment) => (
              <div key={comment.id} className="rounded-lg border border-[#042558]/10 p-2 text-xs">
                <div className="mb-1 flex justify-between gap-2 text-[#042558]/50">
                  <span>{authors[comment.author_id] ?? "Autor"}</span>
                  <span>{new Date(comment.created_at).toLocaleString("pt-BR")}</span>
                </div>
                <p className="whitespace-pre-wrap text-[#042558]">{comment.content}</p>
              </div>
            ))}
          </div>
          {!disabled && (
            <div className="mt-3 space-y-2">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={3}
                className={inputClass}
                placeholder="Adicionar comentário"
              />
              <button
                onClick={() => {
                  if (text.trim()) {
                    onAdd(questionKey, text.trim());
                    setText("");
                  }
                }}
                className="w-full rounded-lg bg-[#042558] px-3 py-2 text-xs font-medium text-white"
              >
                Adicionar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function HistoryList({
  history,
  authors,
}: {
  history: HistoryRow[];
  authors: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  if (!history.length) return null;
  return (
    <div className="mt-3 border-t border-[#042558]/10 pt-3">
      <button
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center gap-1 text-xs font-medium text-[#042558]/60 hover:text-[#042558]"
      >
        <History className="h-3.5 w-3.5" /> Histórico ({history.length})
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {history.map((item) => (
            <div key={item.id} className="rounded-lg bg-[#042558]/5 p-3 text-xs text-[#042558]/70">
              <p>
                {authors[item.changed_by ?? ""] ?? "Usuário"} ·{" "}
                {new Date(item.changed_at).toLocaleString("pt-BR")}
              </p>
              <p className="mt-1">Anterior: {item.previous_answer || "sem resposta"}</p>
              <p>Atual: {item.new_answer || "sem resposta"}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative pb-3 text-sm font-medium transition ${active ? "text-[#042558]" : "text-[#042558]/40 hover:text-[#042558]/70"}`}
    >
      {children}
      {active && (
        <span className="absolute bottom-0 left-0 h-0.5 w-full rounded-full bg-[#042558]" />
      )}
    </button>
  );
}

function getDescendantPositionIds(positions: PositionRow[], leaderId: string) {
  const result = new Set<string>();
  const visit = (parentId: string) => {
    positions
      .filter((position) => position.parent_id === parentId)
      .forEach((child) => {
        result.add(child.id);
        visit(child.id);
      });
  };
  visit(leaderId);
  return result;
}

export function allReviewQuestions(review: ReviewRow) {
  return [
    ...((review.activities_snapshot ?? []) as PerformanceQuestion[]),
    ...((review.questions_snapshot ?? []) as PerformanceQuestion[]),
  ].filter((q) => q.active ?? true);
}

function buildActivityQuestions(dc: DcRow): PerformanceQuestion[] {
  const activities = Array.isArray(dc.atividades) ? dc.atividades : [];
  return activities
    .map((activity, index) => {
      const label = extractActivityLabel(activity, index);
      return {
        id: `activity_${index + 1}`,
        label,
        type: "select" as const,
        required: true,
        active: true,
        options: ACTIVITY_SCALE,
        source: "activity" as const,
      };
    })
    .filter((question) => question.label.trim().length > 0);
}

function extractActivityLabel(activity: Record<string, unknown>, index: number) {
  const strings = Object.values(activity).filter(
    (value): value is string => typeof value === "string" && value.trim().length > 0,
  );
  return strings[0]?.trim() ?? `Atividade ${index + 1}`;
}

export function PublicPerformanceFormFields({
  questions,
  answers,
  onChange,
}: {
  questions: PerformanceQuestion[];
  answers: Record<string, string>;
  onChange: (answers: Record<string, string>) => void;
}) {
  const activeQuestions = useMemo(() => questions.filter((q) => q.active ?? true), [questions]);
  return (
    <div className="space-y-5">
      {activeQuestions.map((question) => (
        <label
          key={question.id}
          className="block rounded-xl border border-gray-200 bg-gray-50/60 p-4"
        >
          <span className="mb-1 block text-sm font-semibold text-gray-700">
            {question.label} {question.required && <span className="text-red-500">*</span>}
          </span>
          {question.helpText && (
            <span className="mb-2 block text-xs text-gray-400">{question.helpText}</span>
          )}
          <QuestionInput
            question={question}
            value={answers[question.id] ?? ""}
            onChange={(value) => onChange({ ...answers, [question.id]: value })}
          />
        </label>
      ))}
    </div>
  );
}

export function validatePerformanceAnswers(
  questions: PerformanceQuestion[],
  answers: Record<string, string>,
) {
  const missing = questions.find(
    (question) => (question.active ?? true) && question.required && !answers[question.id]?.trim(),
  );
  return missing ? `Preencha: ${missing.label}` : null;
}



