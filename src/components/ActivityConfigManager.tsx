import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export type FieldType = "text" | "textarea" | "date" | "select";

export type ActivityField = {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: string[];
};

const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2));

const EXAMPLE_HEADER: ActivityField[] = [
  { id: uid(), label: "Nome completo", type: "text", required: true },
  { id: uid(), label: "Cargo atual", type: "text", required: true },
  { id: uid(), label: "Departamento", type: "text", required: false },
  { id: uid(), label: "Data de preenchimento", type: "date", required: true },
];

const EXAMPLE_QUESTIONS: ActivityField[] = [
  { id: uid(), label: "Descreva as principais atividades do seu dia a dia.", type: "textarea", required: true },
  { id: uid(), label: "Quais ferramentas / sistemas você utiliza?", type: "textarea", required: false },
  { id: uid(), label: "Frequência da atividade principal", type: "select", required: true, options: ["Diária", "Semanal", "Mensal", "Eventual"] },
];

const TYPE_LABEL: Record<FieldType, string> = { text: "Texto curto", textarea: "Texto longo", date: "Data", select: "Seleção" };

const inputClass = "w-full rounded-lg border border-[#042558]/20 bg-white/60 px-3 py-2 text-sm text-[#042558] outline-none transition-all focus:border-[#042558] focus:ring-2 focus:ring-[#042558]/20 placeholder:text-[#042558]/40";

export function ActivityConfigManager({ projectId }: { projectId: string }) {
  const [configId, setConfigId] = useState<string | null>(null);
  const [header, setHeader] = useState<ActivityField[]>([]);
  const [questions, setQuestions] = useState<ActivityField[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("activity_configs").select("*").eq("project_id", projectId).maybeSingle();
    if (data) {
      setConfigId(data.id);
      setHeader((data.header_schema as ActivityField[]) ?? []);
      setQuestions((data.questions_schema as ActivityField[]) ?? []);
      setIsActive(data.is_active);
    } else {
      setConfigId(null);
      setHeader([]);
      setQuestions([]);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const payload = {
      project_id: projectId,
      header_schema: header,
      questions_schema: questions,
      is_active: isActive,
      created_by: userData.user?.id ?? null,
    };
    const { error } = configId
      ? await supabase.from("activity_configs").update(payload).eq("id", configId)
      : await supabase.from("activity_configs").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Configuração salva");
    void load();
  };

  const loadExamples = () => {
    if (header.length || questions.length) {
      if (!confirm("Isso substituirá os campos atuais. Continuar?")) return;
    }
    setHeader(EXAMPLE_HEADER.map((f) => ({ ...f, id: uid() })));
    setQuestions(EXAMPLE_QUESTIONS.map((f) => ({ ...f, id: uid() })));
  };

  if (loading) return (
    <div className="flex h-40 items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#042558] border-t-transparent" />
        <p className="text-sm text-[#042558]/60">Carregando configurações...</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[#042558]/10 bg-white/60 p-6 shadow-sm backdrop-blur-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-[#042558]">Formulário de atividade</h2>
            <p className="mt-1 text-sm text-[#042558]/60">Configure o cabeçalho e as perguntas que o colaborador vai responder.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#042558]/20 bg-white/50 px-3 py-1.5 text-sm text-[#042558] transition-colors hover:bg-[#042558]/5">
              <input 
                type="checkbox" 
                checked={isActive} 
                onChange={(e) => setIsActive(e.target.checked)} 
                className="rounded border-[#042558]/30 text-[#042558] focus:ring-[#042558]/20" 
              /> 
              <span>Ativo</span>
            </label>
            <button 
              onClick={loadExamples} 
              className="rounded-lg border border-[#042558]/20 bg-white/50 px-4 py-2 text-sm font-medium text-[#042558] transition-all hover:bg-[#042558]/5 hover:shadow-md"
            >
              Carregar exemplos
            </button>
            <button 
              onClick={save} 
              disabled={saving} 
              className="rounded-lg bg-[#042558] px-4 py-2 text-sm font-medium text-white shadow-lg shadow-[#042558]/20 transition-all hover:bg-[#042558]/90 hover:shadow-xl hover:shadow-[#042558]/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      </div>

      <FieldsEditor 
        title="Cabeçalho" 
        subtitle="Dados de identificação do respondente." 
        fields={header} 
        setFields={setHeader} 
      />
      <FieldsEditor 
        title="Perguntas" 
        subtitle="Perguntas sobre as atividades do cargo." 
        fields={questions} 
        setFields={setQuestions} 
      />
    </div>
  );
}

function FieldsEditor({ 
  title, 
  subtitle, 
  fields, 
  setFields 
}: { 
  title: string; 
  subtitle: string; 
  fields: ActivityField[]; 
  setFields: (f: ActivityField[]) => void;
}) {
  const add = () => setFields([...fields, { id: uid(), label: "Novo campo", type: "text", required: false }]);
  const update = (id: string, patch: Partial<ActivityField>) => setFields(fields.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const remove = (id: string) => setFields(fields.filter((f) => f.id !== id));
  const move = (id: string, dir: -1 | 1) => {
    const idx = fields.findIndex((f) => f.id === id);
    const next = [...fields];
    const to = idx + dir;
    if (to < 0 || to >= fields.length) return;
    [next[idx], next[to]] = [next[to], next[idx]];
    setFields(next);
  };

  return (
    <div className="rounded-2xl border border-[#042558]/10 bg-white/60 p-6 shadow-sm backdrop-blur-sm transition-all hover:shadow-md">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-[#042558]">
            {title} <span className="text-xs font-normal text-[#042558]/40">({fields.length})</span>
          </h3>
          <p className="text-xs text-[#042558]/50">{subtitle}</p>
        </div>
        <button 
          onClick={add} 
          className="rounded-lg border border-[#042558]/20 bg-white/50 px-4 py-2 text-sm font-medium text-[#042558] transition-all hover:bg-[#042558]/5 hover:shadow-md"
        >
          Adicionar campo
        </button>
      </div>

      {fields.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#042558]/20 p-8">
          <p className="text-sm font-medium text-[#042558]/40">Nenhum campo cadastrado</p>
          <p className="text-xs text-[#042558]/30">Clique em "Adicionar campo" para começar</p>
        </div>
      ) : (
        <div className="space-y-3">
          {fields.map((f, i) => (
            <div 
              key={f.id} 
              className="rounded-xl border border-[#042558]/10 bg-white/70 p-4 transition-all hover:border-[#042558]/30 hover:shadow-sm"
            >
              <div className="flex flex-wrap items-start gap-3">
                {/* Ordem */}
                <div className="flex flex-col items-center gap-0.5 text-[#042558]/30">
                  <button 
                    onClick={() => move(f.id, -1)} 
                    disabled={i === 0} 
                    className="rounded px-1 text-[10px] hover:text-[#042558] disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    ▲
                  </button>
                  <span className="text-[10px] font-medium">{i + 1}</span>
                  <button 
                    onClick={() => move(f.id, 1)} 
                    disabled={i === fields.length - 1} 
                    className="rounded px-1 text-[10px] hover:text-[#042558] disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    ▼
                  </button>
                </div>

                {/* Campos */}
                <div className="flex-1 min-w-[200px] space-y-2">
                  <input 
                    value={f.label} 
                    onChange={(e) => update(f.id, { label: e.target.value })} 
                    placeholder="Rótulo do campo" 
                    className={inputClass} 
                  />
                  {f.type === "select" && (
                    <input
                      value={(f.options ?? []).join(", ")}
                      onChange={(e) => update(f.id, { options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                      placeholder="Opções separadas por vírgula"
                      className={inputClass}
                    />
                  )}
                </div>

                {/* Tipo */}
                <select 
                  value={f.type} 
                  onChange={(e) => update(f.id, { type: e.target.value as FieldType })} 
                  className={`${inputClass} w-[140px]`}
                >
                  {(Object.keys(TYPE_LABEL) as FieldType[]).map((t) => (
                    <option key={t} value={t}>{TYPE_LABEL[t]}</option>
                  ))}
                </select>

                {/* Obrigatório */}
                <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#042558]/20 bg-white/50 px-3 py-1.5 text-xs text-[#042558] transition-colors hover:bg-[#042558]/5">
                  <input 
                    type="checkbox" 
                    checked={f.required} 
                    onChange={(e) => update(f.id, { required: e.target.checked })} 
                    className="rounded border-[#042558]/30 text-[#042558] focus:ring-[#042558]/20" 
                  /> 
                  Obrigatório
                </label>

                {/* Remover */}
                <button 
                  onClick={() => remove(f.id)} 
                  className="rounded-lg p-2 text-[#042558]/30 transition-colors hover:bg-red-50 hover:text-red-600"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}