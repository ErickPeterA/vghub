import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

type Field = { id: string; label: string; type: "text" | "textarea" | "date" | "select"; required: boolean; options?: string[] };

type FormData = { ok: true; label: string | null; header: Field[]; questions: Field[] };
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
  const [questionAns, setQuestionAns] = useState<Record<string, string>>({});

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
          setState("ready");
        }
      })
      .catch(() => {
        if (!cancelled) { setErrorMsg("Erro de conexão."); setState("error"); }
      });
    return () => { cancelled = true; };
  }, [token]);

  const validate = (): string | null => {
    if (!form) return null;
    for (const f of form.header) if (f.required && !headerAns[f.id]?.trim()) return `Preencha: ${f.label}`;
    for (const f of form.questions) if (f.required && !questionAns[f.id]?.trim()) return `Preencha: ${f.label}`;
    return null;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) { setErrorMsg(err); return; }
    setErrorMsg("");
    setState("submitting");
    try {
      const r = await fetch(`/api/public/activity-response/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ header_answers: headerAns, question_answers: questionAns }),
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
    <div className="min-h-screen bg-gradient-to-br from-[#042558]/5 via-white to-[#042558]/5 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 text-center">
          <p className="text-xs uppercase tracking-widest text-[#042558]/60">Formulário de atividades</p>
          <h1 className="mt-2 font-display text-3xl text-[#042558]">Preenchimento</h1>
          {form?.label && <p className="mt-1 text-sm text-[#042558]/60">{form.label}</p>}
        </div>

        {state === "loading" && (
          <div className="flex items-center justify-center gap-2 py-16 text-[#042558]/60">
            <Loader2 className="h-5 w-5 animate-spin" /> Carregando...
          </div>
        )}

        {state === "error" && !form && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
            <AlertCircle className="mx-auto h-10 w-10 text-red-500" />
            <p className="mt-4 text-lg font-medium text-red-800">{errorMsg}</p>
          </div>
        )}

        {state === "success" && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
            <p className="mt-4 text-lg font-medium text-emerald-800">Resposta enviada com sucesso!</p>
            <p className="mt-1 text-sm text-emerald-700">Obrigado por preencher. Você já pode fechar esta página.</p>
          </div>
        )}

        {(state === "ready" || state === "submitting") && form && (
          <form onSubmit={submit} className="space-y-6">
            {form.header.length > 0 && (
              <section className="rounded-2xl border border-[#042558]/10 bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[#042558]">Identificação</h2>
                <div className="space-y-4">
                  {form.header.map((f) => (
                    <FieldInput key={f.id} field={f} value={headerAns[f.id] ?? ""} onChange={(v) => setHeaderAns({ ...headerAns, [f.id]: v })} />
                  ))}
                </div>
              </section>
            )}

            {form.questions.length > 0 && (
              <section className="rounded-2xl border border-[#042558]/10 bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[#042558]">Perguntas</h2>
                <div className="space-y-4">
                  {form.questions.map((f) => (
                    <FieldInput key={f.id} field={f} value={questionAns[f.id] ?? ""} onChange={(v) => setQuestionAns({ ...questionAns, [f.id]: v })} />
                  ))}
                </div>
              </section>
            )}

            {errorMsg && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{errorMsg}</p>}

            <button type="submit" disabled={state === "submitting"} className="w-full rounded-xl bg-[#042558] px-6 py-3 text-base font-medium text-white shadow-lg shadow-[#042558]/20 hover:bg-[#042558]/90 disabled:opacity-50">
              {state === "submitting" ? "Enviando..." : "Enviar respostas"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function FieldInput({ field, value, onChange }: { field: Field; value: string; onChange: (v: string) => void }) {
  const base = "w-full rounded-lg border border-[#042558]/20 bg-white px-3 py-2.5 text-sm text-[#042558] outline-none focus:border-[#042558] focus:ring-2 focus:ring-[#042558]/20";
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-[#042558]">
        {field.label} {field.required && <span className="text-red-500">*</span>}
      </span>
      {field.type === "textarea" ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={4} className={base} />
      ) : field.type === "select" ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} className={base}>
          <option value="">— Selecione —</option>
          {(field.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : field.type === "date" ? (
        <input type="date" value={value} onChange={(e) => onChange(e.target.value)} className={base} />
      ) : (
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className={base} />
      )}
    </label>
  );
}
