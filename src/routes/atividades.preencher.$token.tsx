import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Plus, Trash2 } from "lucide-react";

type Field = {
  id: string;
  label: string;
  type: "text" | "textarea" | "date" | "select";
  required: boolean;
  options?: string[];
  filledBy?: "gp" | "collaborator";
  helpText?: string;
  dataSource?: "manual" | "areas" | "setores";
};

type ProjectArea = {
  id: string;
  parent_id: string | null;
  nome: string;
  cor: string | null;
};

type QuestionAnswerGroup = Record<string, string>;

type FormData = {
  ok: true;
  label: string | null;
  prefilledHeader?: Record<string, string>;
  draftHeader?: Record<string, string>;
  draftQuestions?: QuestionAnswerGroup | QuestionAnswerGroup[];
  draftSavedAt?: string | null;
  areas?: ProjectArea[];
  header: Field[];
  questions: Field[];
};
type FormError = { error: string; message: string };

export const Route = createFileRoute("/atividades/preencher/$token")({
  component: PublicForm,
});

function PublicForm() {
  const { token } = Route.useParams();
  const [state, setState] = useState<"loading" | "ready" | "error" | "submitting" | "success">("loading");
  const [form, setForm] = useState<FormData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [headerAns, setHeaderAns] = useState<Record<string, string>>({});
  const [questionGroups, setQuestionGroups] = useState<QuestionAnswerGroup[]>([{}]);
  const [draftState, setDraftState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const hydratedRef = useRef(false);
  const headerAreaField = form?.header.find((field) => field.dataSource === "areas");
  const headerSetorField = form?.header.find((field) => field.dataSource === "setores");
  const questionAreaField = form?.questions.find((field) => field.dataSource === "areas");
  const questionSetorField = form?.questions.find((field) => field.dataSource === "setores");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/public/activity-form/${token}`)
      .then(async (r) => {
        const json = (await r.json()) as FormData | FormError;
        if (cancelled) return;
        if (!r.ok || "error" in json) {
          setErrorMsg((json as FormError).message ?? "Não foi possível carregar o formulário.");
          setState("error");
        } else {
          setForm(json);
          setHeaderAns({ ...(json.prefilledHeader ?? {}), ...(json.draftHeader ?? {}) });
          setQuestionGroups(normalizeQuestionGroups(json.draftQuestions));
          setDraftSavedAt(json.draftSavedAt ?? null);
          setState("ready");
          hydratedRef.current = true;
        }
      })
      .catch(() => {
        if (!cancelled) { setErrorMsg("Erro de conexão."); setState("error"); }
      });
    return () => { cancelled = true; };
  }, [token]);

  useEffect(() => {
    if (!hydratedRef.current || state !== "ready") return;
    const timeout = window.setTimeout(async () => {
      setDraftState("saving");
      try {
        const r = await fetch(`/api/public/activity-draft/${token}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ header_answers: headerAns, question_answers: questionGroups }),
        });
        const json = (await r.json()) as { ok?: true; savedAt?: string } | FormError;
        if (!r.ok || "error" in json) {
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
  }, [headerAns, questionGroups, state, token]);

  const validate = (): string | null => {
    if (!form) return null;
    for (const f of form.header) {
      if ((f.filledBy ?? "collaborator") === "gp") continue;
      if (f.required && !headerAns[f.id]?.trim()) return `Preencha: ${f.label}`;
    }
    for (let index = 0; index < questionGroups.length; index += 1) {
      for (const f of form.questions) {
        if (f.required && !questionGroups[index]?.[f.id]?.trim()) {
          return `Preencha: ${f.label} na pergunta ${index + 1}`;
        }
      }
    }
    return null;
  };

  const addQuestionGroup = () => {
    setQuestionGroups((current) => [...current, {}]);
  };

  const removeQuestionGroup = (index: number) => {
    setQuestionGroups((current) => current.length <= 1 ? current : current.filter((_, currentIndex) => currentIndex !== index));
  };

  const updateQuestionGroup = (index: number, field: Field, value: string) => {
    setQuestionGroups((current) => current.map((group, currentIndex) => {
      if (currentIndex !== index) return group;
      const next = { ...group, [field.id]: value };
      if (field.dataSource === "areas" && questionSetorField) next[questionSetorField.id] = "";
      return next;
    }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) { setErrorMsg(err); return; }
    setErrorMsg("");
    setDraftState("idle");
    setState("submitting");
    try {
      const r = await fetch(`/api/public/activity-response/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ header_answers: headerAns, question_answers: questionGroups }),
      });
      const json = (await r.json()) as { ok?: true } | FormError;
      if (!r.ok || "error" in json) {
        setErrorMsg((json as FormError).message ?? "Erro ao enviar.");
        setState("error");
      } else {
        setState("success");
      }
    } catch {
      setErrorMsg("Erro de conexão.");
      setState("error");
    }
  };

  return (
    <div className="min-h-screen bg-[#042558]/5 px-4 py-12">
      <div className="mx-auto max-w-3xl">
        {/* Card principal */}
        <div className="overflow-hidden rounded-xl bg-white shadow-lg shadow-[#042558]/10">
          {/* Header com cor principal */}
          <div className="bg-[#042558] px-8 py-6">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-white/60">
                Formulário
              </p>
              <h1 className="text-2xl font-bold text-white">
                {form?.label || "Preenchimento"}
              </h1>
            </div>
          </div>

          <div className="p-8">
            {/* Indicador de rascunho */}
            {(state === "ready" || state === "submitting") && (
              <div className="mb-6 flex items-center justify-between rounded-lg bg-gray-50 px-4 py-2 text-xs text-gray-500">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-[#042558]/40" />
                  {draftState === "saving" && (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin text-[#042558]" />
                      <span>Salvando rascunho...</span>
                    </>
                  )}
                  {draftState === "saved" && (
                    <>
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                      <span>Rascunho salvo {draftSavedAt ? `às ${new Date(draftSavedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : ""}</span>
                    </>
                  )}
                  {draftState === "error" && (
                    <>
                      <AlertCircle className="h-3 w-3 text-red-500" />
                      <span>Erro ao salvar rascunho</span>
                    </>
                  )}
                  {draftState === "idle" && draftSavedAt && (
                    <span>Rascunho de {new Date(draftSavedAt).toLocaleDateString("pt-BR")}</span>
                  )}
                </div>
              </div>
            )}

            {/* Estados de loading/error/success */}
            {state === "loading" && (
              <div className="flex flex-col items-center justify-center gap-4 py-16">
                <Loader2 className="h-8 w-8 animate-spin text-[#042558]" />
                <p className="text-sm text-gray-400">Carregando formulário...</p>
              </div>
            )}

            {state === "error" && !form && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center">
                <AlertCircle className="mx-auto mb-3 h-10 w-10 text-red-500" />
                <p className="text-gray-700">{errorMsg}</p>
              </div>
            )}

            {state === "success" && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-8 text-center">
                <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-500" />
                <h3 className="text-lg font-semibold text-emerald-700">Resposta enviada!</h3>
                <p className="mt-1 text-sm text-emerald-600">Obrigado por preencher o formulário.</p>
              </div>
            )}

            {/* Formulário */}
            {(state === "ready" || state === "submitting") && form && (
              <form onSubmit={submit} className="space-y-8">
                {form.header.length > 0 && (
                  <section>
                    <div className="mb-4 border-b border-gray-200 pb-3">
                      <h2 className="font-semibold text-gray-700">Identificação</h2>
                    </div>
                    <div className="space-y-4">
                      {form.header.map((f) => (
                        <FieldInput
                          key={f.id}
                          field={f}
                          value={headerAns[f.id] ?? ""}
                          readOnly={(f.filledBy ?? "collaborator") === "gp"}
                          areas={form.areas ?? []}
                          parentAreaId={f.dataSource === "setores" && headerAreaField ? headerAns[headerAreaField.id] : undefined}
                          onChange={(v) => setHeaderAns((current) => {
                            const next = { ...current, [f.id]: v };
                            if (f.dataSource === "areas" && headerSetorField) next[headerSetorField.id] = "";
                            return next;
                          })}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {form.questions.length > 0 && (
                  <section>
                    <div className="mb-4 flex items-center gap-2 border-b border-gray-200 pb-3">
                      <div className="flex items-center gap-2">
                        <h2 className="font-semibold text-gray-700">Perguntas</h2>
                        <span className="rounded-full bg-[#042558]/10 px-2 py-0.5 text-xs font-medium text-[#042558]">
                          {questionGroups.length} {questionGroups.length === 1 ? "pergunta" : "perguntas"}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-4">
                      {questionGroups.map((group, index) => (
                        <div key={index} className="rounded-xl border border-gray-200 bg-gray-50/50 p-4">
                          <div className="mb-4 flex items-center justify-between gap-3">
                            <h3 className="text-sm font-semibold uppercase tracking-wider text-[#042558]/70">
                              Pergunta {String(index + 1).padStart(2, "0")}
                            </h3>
                            {questionGroups.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeQuestionGroup(index)}
                                className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                                title="Remover pergunta"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                          <div className="space-y-4">
                            {form.questions.map((f) => (
                              <FieldInput
                                key={f.id}
                                field={f}
                                value={group[f.id] ?? ""}
                                areas={form.areas ?? []}
                                parentAreaId={f.dataSource === "setores" && questionAreaField ? group[questionAreaField.id] : undefined}
                                onChange={(v) => updateQuestionGroup(index, f, v)}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={addQuestionGroup}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[#042558]/30 bg-white px-4 py-3 text-sm font-medium text-[#042558] transition-all hover:bg-[#042558]/5"
                      >
                        <Plus className="h-4 w-4" />
                        Adicionar mais uma pergunta
                      </button>
                    </div>
                  </section>
                )}

                {errorMsg && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                    <p className="text-sm text-red-600">{errorMsg}</p>
                  </div>
                )}

                <button 
                  type="submit" 
                  disabled={state === "submitting"} 
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#042558] px-6 py-3 text-sm font-medium text-white transition-all hover:bg-[#042558]/90 hover:shadow-lg hover:shadow-[#042558]/20 disabled:opacity-50"
                >
                  {state === "submitting" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    "Enviar respostas"
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function normalizeQuestionGroups(value?: QuestionAnswerGroup | QuestionAnswerGroup[]): QuestionAnswerGroup[] {
  if (Array.isArray(value)) return value.length ? value : [{}];
  if (value && typeof value === "object") return [value];
  return [{}];
}

function FieldInput({
  field,
  value,
  onChange,
  readOnly = false,
  areas = [],
  parentAreaId,
}: {
  field: Field;
  value: string;
  onChange: (v: string) => void;
  readOnly?: boolean;
  areas?: ProjectArea[];
  parentAreaId?: string;
}) {
  const base = `w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700 outline-none transition-all focus:border-[#042558] focus:ring-2 focus:ring-[#042558]/20 ${readOnly ? "bg-gray-50 text-gray-500" : "hover:border-gray-300"}`;
  const areaOptions = areas.filter((area) => !area.parent_id);
  const setorOptions = areas.filter((area) => area.parent_id && (!parentAreaId || area.parent_id === parentAreaId));
  
  return (
    <div className="space-y-1.5">
      <label className="flex items-baseline gap-1 text-sm font-medium text-gray-700">
        {field.label}
        {field.required && <span className="text-red-500">*</span>}
        {readOnly && (
          <span className="ml-auto text-xs font-normal text-gray-400">
            (pré-preenchido)
          </span>
        )}
      </label>
      
      {field.helpText && (
        <p className="text-xs text-gray-400">{field.helpText}</p>
      )}
      
      {field.type === "textarea" ? (
        <textarea 
          value={value} 
          onChange={(e) => onChange(e.target.value)} 
          rows={3} 
          className={`${base} resize-y`} 
          readOnly={readOnly} 
        />
      ) : field.dataSource === "areas" ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${base} appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-10`}
          disabled={readOnly}
        >
          <option value="">Selecione uma opção</option>
          {areaOptions.map((area) => <option key={area.id} value={area.id}>{area.nome}</option>)}
        </select>
      ) : field.dataSource === "setores" ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${base} appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-10`}
          disabled={readOnly || !parentAreaId}
        >
          <option value="">{parentAreaId ? "Selecione uma opção" : "Selecione a Área primeiro"}</option>
          {setorOptions.map((area) => <option key={area.id} value={area.id}>{area.nome}</option>)}
        </select>
      ) : field.type === "select" ? (
        <select 
          value={value} 
          onChange={(e) => onChange(e.target.value)} 
          className={`${base} appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-10`} 
          disabled={readOnly}
        >
          <option value="">Selecione uma opção</option>
          {(field.options ?? []).map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      ) : field.type === "date" ? (
        <input 
          type="date" 
          value={value} 
          onChange={(e) => onChange(e.target.value)} 
          className={base} 
          readOnly={readOnly} 
        />
      ) : (
        <input 
          type="text" 
          value={value} 
          onChange={(e) => onChange(e.target.value)} 
          className={base} 
          readOnly={readOnly} 
        />
      )}
    </div>
  );
}
