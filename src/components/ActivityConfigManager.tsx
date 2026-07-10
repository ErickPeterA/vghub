import { memo, useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronUp, GripVertical, Layers, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { supabase } from "@/integrations/supabase/client";

export type FieldType = "text" | "textarea" | "date" | "select";
export type FilledBy = "gp" | "collaborator";

export type ActivityField = {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  active?: boolean;
  options?: string[];
  filledBy?: FilledBy;
  helpText?: string;
};

const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2));

export const DEFAULT_ACTIVITY_HEADER: ActivityField[] = [
  { id: "nome", label: "Nome", type: "text", required: true, active: true, filledBy: "gp" },
  { id: "area_setor", label: "Área e setor", type: "text", required: true, active: true, filledBy: "gp" },
  { id: "data_inicio", label: "Data de início", type: "date", required: true, active: true, filledBy: "gp" },
  { id: "data_finalizacao", label: "Data de finalização", type: "date", required: true, active: true, filledBy: "collaborator" },
  { id: "cargo", label: "Cargo", type: "text", required: true, active: true, filledBy: "gp" },
];

export const DEFAULT_ACTIVITY_QUESTIONS: ActivityField[] = [
  {
    id: "inicio_dependencia",
    label: "Para iniciar essa tarefa, depende de algum documento ou algo de alguém?",
    type: "textarea",
    required: false,
    active: true,
    helpText: "Informe o que é necessário e de quem vem.",
  },
  {
    id: "periodicidade",
    label: "Periodicidade",
    type: "select",
    required: true,
    active: true,
    helpText: "Com qual frequência normalmente você executa a atividade a seguir.",
    options: ["Sempre que necessário", "Diariamente", "Semanalmente", "Quinzenalmente", "Mensalmente", "Bimensalmente", "Trimestralmente", "Semestralmente", "Anualmente"],
  },
  {
    id: "atividade",
    label: "Atividade",
    type: "textarea",
    required: true,
    active: true,
    helpText: "Descrever apenas o que você faz, não o como. Use verbo + objeto.",
  },
  {
    id: "complexidade",
    label: "Complexidade da atividade",
    type: "select",
    required: true,
    active: true,
    options: ["Alta Complexidade", "Média Complexidade", "Baixa Complexidade"],
  },
  {
    id: "autonomia_responsabilidade",
    label: "Autonomia e responsabilidade",
    type: "select",
    required: true,
    active: true,
    options: ["Executa", "Executa e decide", "Executa, decide e orienta outro"],
  },
  {
    id: "ferramentas_sistemas",
    label: "Ferramentas / Sistemas",
    type: "textarea",
    required: false,
    active: true,
    helpText: "Cite o que você usa de recurso para executar esta atividade.",
  },
  {
    id: "fim_atividade",
    label: "Fim da atividade",
    type: "textarea",
    required: false,
    active: true,
    helpText: "Informe o que é entregue e para quem.",
  },
  {
    id: "indicador_relacionado",
    label: "Indicador relacionado",
    type: "textarea",
    required: false,
    active: true,
    helpText: "Existe alguma forma de controlar que esta atividade está sendo feita corretamente?",
  },
];

const types: Array<{ value: FieldType; label: string }> = [
  { value: "text", label: "Texto" },
  { value: "textarea", label: "Texto longo" },
  { value: "date", label: "Data" },
  { value: "select", label: "Seleção única" },
];

const filledByOptions: Array<{ value: FilledBy; label: string }> = [
  { value: "gp", label: "GP/Admin" },
  { value: "collaborator", label: "Colaborador" },
];

const inputClass = "w-full rounded-lg border border-[#042558]/20 bg-white/50 px-3 py-2 text-sm text-[#042558] outline-none transition-all focus:border-[#042558] focus:ring-2 focus:ring-[#042558]/20 placeholder:text-[#042558]/40";

const cloneDefaults = (fields: ActivityField[]) => fields.map((field) => ({ ...field, id: `${field.id}_${uid()}` }));
const normalizeFields = (fields: ActivityField[]) => fields.map((field) => ({ ...field, active: field.active ?? true }));

export function ActivityConfigManager({ projectId }: { projectId: string }) {
  const [configId, setConfigId] = useState<string | null>(null);
  const [header, setHeader] = useState<ActivityField[]>([]);
  const [questions, setQuestions] = useState<ActivityField[]>([]);
  const [newLabel, setNewLabel] = useState<Record<"header" | "questions", string>>({ header: "", questions: "" });
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("activity_configs").select("*").eq("project_id", projectId).maybeSingle();
    if (data) {
      setConfigId(data.id);
      setHeader(normalizeFields((data.header_schema as ActivityField[]) ?? []));
      setQuestions(normalizeFields((data.questions_schema as ActivityField[]) ?? []));
      setIsActive(data.is_active);
    } else {
      setConfigId(null);
      setHeader(cloneDefaults(DEFAULT_ACTIVITY_HEADER));
      setQuestions(cloneDefaults(DEFAULT_ACTIVITY_QUESTIONS));
      setIsActive(true);
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

  const restoreDefault = () => {
    if ((header.length || questions.length) && !confirm("Isso substituirá os campos atuais pelo padrão de atividades. Continuar?")) return;
    setHeader(cloneDefaults(DEFAULT_ACTIVITY_HEADER));
    setQuestions(cloneDefaults(DEFAULT_ACTIVITY_QUESTIONS));
  };

  const addField = (section: "header" | "questions") => {
    const label = newLabel[section].trim();
    if (!label) return;
    const field: ActivityField = {
      id: uid(),
      label,
      type: "text",
      required: false,
      active: true,
      filledBy: section === "header" ? "collaborator" : undefined,
    };
    if (section === "header") setHeader((current) => [...current, field]);
    else setQuestions((current) => [...current, field]);
    setNewLabel((current) => ({ ...current, [section]: "" }));
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
    <div className="space-y-8">
      <div className="rounded-2xl border border-[#042558]/10 bg-white/80 p-6 shadow-sm backdrop-blur-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-[#042558]">Formulário de atividades</h2>
            <p className="mt-1 text-sm text-[#042558]/60">Configure os campos do mesmo jeito da Base do Projeto.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#042558]/20 bg-white/50 px-3 py-2 text-sm text-[#042558] transition-colors hover:bg-[#042558]/5">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded border-[#042558]/30 text-[#042558] focus:ring-[#042558]/20" />
              Ativo
            </label>
            <button onClick={restoreDefault} className="rounded-lg border border-[#042558]/20 bg-white/50 px-4 py-2 text-sm font-medium text-[#042558] transition-all hover:bg-[#042558]/5 hover:shadow-md">
              Restaurar padrão
            </button>
            <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[#042558] px-4 py-2 text-sm font-medium text-white shadow-lg shadow-[#042558]/20 transition-all hover:bg-[#042558]/90 hover:shadow-xl hover:shadow-[#042558]/30 disabled:cursor-not-allowed disabled:opacity-50">
              <Save className="h-4 w-4" /> {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      </div>

      <FieldsEditor
        title="Cabeçalho"
        blockNumber="01"
        addPlaceholder="Novo campo em Cabeçalho"
        fields={header}
        setFields={setHeader}
        newLabel={newLabel.header}
        onNewLabelChange={(value) => setNewLabel((current) => ({ ...current, header: value }))}
        onAdd={() => addField("header")}
        allowFilledBy
        onSave={save}
      />

      <FieldsEditor
        title="Perguntas"
        blockNumber="02"
        addPlaceholder="Nova pergunta"
        fields={questions}
        setFields={setQuestions}
        newLabel={newLabel.questions}
        onNewLabelChange={(value) => setNewLabel((current) => ({ ...current, questions: value }))}
        onAdd={() => addField("questions")}
        onSave={save}
      />
    </div>
  );
}

function FieldsEditor({
  title,
  blockNumber,
  addPlaceholder,
  fields,
  setFields,
  newLabel,
  onNewLabelChange,
  onAdd,
  allowFilledBy = false,
  onSave,
}: {
  title: string;
  blockNumber: string;
  addPlaceholder: string;
  fields: ActivityField[];
  setFields: (f: ActivityField[]) => void;
  newLabel: string;
  onNewLabelChange: (value: string) => void;
  onAdd: () => void;
  allowFilledBy?: boolean;
  onSave: () => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const patch = (id: string, patchData: Partial<ActivityField>) => setFields(fields.map((f) => (f.id === id ? { ...f, ...patchData } : f)));
  const remove = (id: string) => setFields(fields.filter((f) => f.id !== id));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = fields.findIndex((field) => field.id === active.id);
    const newIndex = fields.findIndex((field) => field.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    setFields(arrayMove(fields, oldIndex, newIndex));
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-[#042558]/10 bg-white/60 shadow-sm backdrop-blur-sm transition-all hover:shadow-md">
      <div className="border-b border-[#042558]/10 bg-[#042558]/5 p-5">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#042558]/50">Bloco {blockNumber}</p>
            <h3 className="text-xl font-bold text-[#042558]">{title}</h3>
            <p className="mt-0.5 text-xs text-[#042558]/40">
              Arraste os campos pela alça <GripVertical className="inline h-3 w-3" /> para reordenar
            </p>
          </div>
          <span className="rounded-full bg-[#042558]/10 px-3 py-1 text-xs font-medium text-[#042558]">
            {fields.length} campo{fields.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      <div className="p-5">
        <div className="mb-4 flex gap-2">
          <input
            value={newLabel}
            onChange={(e) => onNewLabelChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), onAdd())}
            className={inputClass}
            placeholder={addPlaceholder}
          />
          <button type="button" onClick={onAdd} className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[#042558] px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-[#042558]/20 transition-all hover:bg-[#042558]/90 hover:shadow-xl hover:shadow-[#042558]/30">
            <Plus className="h-4 w-4" /> Criar campo
          </button>
        </div>

        {fields.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#042558]/20 p-8">
            <Layers className="mb-2 h-8 w-8 text-[#042558]/20" />
            <p className="text-sm font-medium text-[#042558]/40">Nenhum campo neste bloco</p>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={fields.map((field) => field.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-3">
                {fields.map((field) => (
                  <SortableActivityFieldRow
                    key={field.id}
                    field={field}
                    allowFilledBy={allowFilledBy}
                    onPatch={patch}
                    onRemove={remove}
                    onSave={onSave}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </section>
  );
}

const SortableActivityFieldRow = memo(function SortableActivityFieldRow({
  field,
  allowFilledBy,
  onPatch,
  onRemove,
  onSave,
}: {
  field: ActivityField;
  allowFilledBy: boolean;
  onPatch: (id: string, patch: Partial<ActivityField>) => void;
  onRemove: (id: string) => void;
  onSave: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id });
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [newOption, setNewOption] = useState("");
  const showOptions = field.type === "select";

  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const options = field.options ?? [];

  const addOption = () => {
    const label = newOption.trim();
    if (!label) return;
    onPatch(field.id, { options: [...options, label] });
    setNewOption("");
  };

  const removeOption = (option: string) => {
    onPatch(field.id, { options: options.filter((current) => current !== option) });
  };

  return (
    <div ref={setNodeRef} style={style} className="rounded-xl border border-[#042558]/10 bg-white/60 p-4 shadow-sm transition-all hover:border-[#042558]/30 hover:shadow-md">
      <div className={`grid gap-3 ${allowFilledBy ? "md:grid-cols-[auto_1.5fr_1fr_1fr_auto]" : "md:grid-cols-[auto_1.8fr_1fr_auto]"}`}>
        <button type="button" {...attributes} {...listeners} className="flex cursor-grab items-center justify-center rounded-lg border border-[#042558]/20 bg-white/50 px-2 transition-colors hover:bg-[#042558]/10 active:cursor-grabbing" title="Arrastar para reordenar">
          <GripVertical className="h-4 w-4 text-[#042558]/40" />
        </button>
        <input value={field.label} onChange={(e) => onPatch(field.id, { label: e.target.value })} className={inputClass} aria-label="Nome do campo" />
        {allowFilledBy && (
          <select value={field.filledBy ?? "collaborator"} onChange={(e) => onPatch(field.id, { filledBy: e.target.value as FilledBy })} className={inputClass} aria-label="Preenchido por">
            {filledByOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        )}
        <select value={field.type} onChange={(e) => onPatch(field.id, { type: e.target.value as FieldType })} className={inputClass} aria-label="Tipo do campo">
          {types.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
        </select>
        <div className="flex gap-1.5">
          <button type="button" onClick={onSave} className="rounded-lg border border-[#042558]/20 bg-white/50 p-2 text-[#042558] transition-colors hover:bg-[#042558] hover:text-white hover:shadow-lg hover:shadow-[#042558]/20" title="Salvar">
            <Save className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => onRemove(field.id)} className="rounded-lg border border-[#042558]/20 bg-white/50 p-2 text-[#042558]/40 transition-colors hover:border-red-500 hover:bg-red-50 hover:text-red-600" title="Excluir">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-5 text-sm">
        <label className="flex cursor-pointer items-center gap-1.5 text-[#042558]/60 transition-colors hover:text-[#042558]">
          <input type="checkbox" checked={field.required} onChange={(e) => onPatch(field.id, { required: e.target.checked })} className="rounded border-[#042558]/30 text-[#042558] focus:ring-[#042558]/20" /> Obrigatório
        </label>
        <label className="flex cursor-pointer items-center gap-1.5 text-[#042558]/60 transition-colors hover:text-[#042558]">
          <input type="checkbox" checked={field.active ?? true} onChange={(e) => onPatch(field.id, { active: e.target.checked })} className="rounded border-[#042558]/30 text-[#042558] focus:ring-[#042558]/20" /> Ativo
        </label>
      </div>

      {showOptions && (
        <div className="mt-4 border-t border-[#042558]/10 pt-4">
          <button type="button" onClick={() => setOptionsOpen((value) => !value)} className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-[#042558]/50 transition-colors hover:text-[#042558]">
            Opções ({options.length})
            {optionsOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>

          {optionsOpen && (
            <>
              <div className="mb-3 flex gap-2">
                <input value={newOption} onChange={(e) => setNewOption(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addOption())} placeholder="Nova opção..." className={inputClass} />
                <button type="button" onClick={addOption} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#042558]/20 bg-white/60 px-3 py-2 text-sm font-medium text-[#042558] transition-all hover:bg-[#042558] hover:text-white hover:shadow-lg hover:shadow-[#042558]/20">
                  <Plus className="h-3.5 w-3.5" /> Adicionar
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {options.map((option) => (
                  <span key={option} className="inline-flex items-center gap-2 rounded-full border border-[#042558]/20 bg-white/60 px-3 py-1 text-sm text-[#042558]">
                    {option}
                    <button type="button" onClick={() => removeOption(option)} aria-label="Excluir opção" className="text-[#042558]/40 transition-colors hover:text-red-600">×</button>
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
});
