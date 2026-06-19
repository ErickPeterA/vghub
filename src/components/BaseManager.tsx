import { useEffect, useState, useRef, useCallback, memo } from "react";
import { Plus, Save, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DC_SECTIONS, SECTION_KEYS } from "@/lib/dc-sections";

type FieldType = "text" | "textarea" | "number" | "date" | "checkbox" | "single_select" | "multi_select";
type Option = { id: string; label: string; value: string; display_order: number; is_active: boolean };
type Field = {
  id: string; field_key: string; label: string; section: string; field_type: FieldType;
  is_required: boolean; display_order: number; allows_multiple: boolean;
  allows_free_text: boolean; is_active: boolean; base_options: Option[];
};

const inputClass = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";
const types: Array<{ value: FieldType; label: string }> = [
  { value: "text", label: "Texto livre" },
  { value: "textarea", label: "Texto longo" },
  { value: "number", label: "Número" },
  { value: "date", label: "Data" },
  { value: "checkbox", label: "Sim/Não" },
  { value: "single_select", label: "Seleção única" },
  { value: "multi_select", label: "Seleção múltipla" },
];

const slugify = (raw: string) =>
  raw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

// ---- OptionRow isolado com memo para não re-renderizar os outros ----
const OptionRow = memo(function OptionRow({
  option,
  onToggle,
  onRemove,
}: {
  option: Option;
  onToggle: (id: string, active: boolean) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${
        option.is_active ? "border-border" : "border-dashed opacity-50"
      }`}
    >
      <button type="button" onClick={() => onToggle(option.id, !option.is_active)}>
        {option.label}
      </button>
      <button
        type="button"
        onClick={() => onRemove(option.id)}
        aria-label="Excluir opção"
        className="text-muted-foreground hover:text-destructive"
      >
        ×
      </button>
    </span>
  );
});

// ---- FieldRow isolado com memo para não re-renderizar os outros campos ----
const FieldRow = memo(function FieldRow({
  field,
  onPatch,
  onSave,
  onRemove,
  onAddOption,
  onToggleOption,
  onRemoveOption,
}: {
  field: Field;
  onPatch: (id: string, patch: Partial<Field>) => void;
  onSave: (field: Field) => void;
  onRemove: (id: string) => void;
  onAddOption: (fieldId: string, label: string) => void;
  onToggleOption: (fieldId: string, optionId: string, active: boolean) => void;
  onRemoveOption: (fieldId: string, optionId: string) => void;
}) {
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [newOptionLabel, setNewOptionLabel] = useState("");
  const hasSelect = field.field_type === "single_select" || field.field_type === "multi_select";

  const handleAddOption = () => {
    const label = newOptionLabel.trim();
    if (!label) return;
    onAddOption(field.id, label);
    setNewOptionLabel("");
  };

  return (
    <div className="rounded-xl border border-border bg-background/50 p-4">
      <div className="grid gap-3 md:grid-cols-[1.4fr_1fr_1fr_90px_auto]">
        <input
          value={field.label}
          onChange={(e) => onPatch(field.id, { label: e.target.value })}
          className={inputClass}
          aria-label="Nome do campo"
        />
        <select
          value={field.section}
          onChange={(e) => onPatch(field.id, { section: e.target.value })}
          className={inputClass}
          aria-label="Bloco"
        >
          {SECTION_KEYS.map((key) => <option key={key} value={key}>{key}</option>)}
        </select>
        <select
          value={field.field_type}
          onChange={(e) =>
            onPatch(field.id, {
              field_type: e.target.value as FieldType,
              allows_multiple: e.target.value === "multi_select",
            })
          }
          className={inputClass}
          aria-label="Tipo do campo"
        >
          {types.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
        </select>
        <input
          type="number"
          value={field.display_order}
          onChange={(e) => onPatch(field.id, { display_order: Number(e.target.value) })}
          className={inputClass}
          aria-label="Ordem"
        />
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => onSave(field)}
            className="rounded-md border border-border p-2 hover:bg-secondary"
            title="Salvar"
          >
            <Save className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onRemove(field.id)}
            className="rounded-md border border-border p-2 text-destructive hover:bg-destructive/10"
            title="Excluir"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-5 text-sm">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={field.is_required}
            onChange={(e) => onPatch(field.id, { is_required: e.target.checked })}
          /> Obrigatório
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={field.is_active}
            onChange={(e) => onPatch(field.id, { is_active: e.target.checked })}
          /> Ativo
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={field.allows_free_text}
            onChange={(e) => onPatch(field.id, { allows_free_text: e.target.checked })}
          /> Permitir digitação livre
        </label>
      </div>

      {hasSelect && (
        <div className="mt-4 border-t border-border pt-4">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setOptionsOpen((v) => !v)}
              className="flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              Opções ({field.base_options.length})
              {optionsOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          </div>

          {optionsOpen && (
            <>
              <div className="mb-3 flex gap-2">
                <input
                  value={newOptionLabel}
                  onChange={(e) => setNewOptionLabel(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddOption())}
                  placeholder="Nova opção..."
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={handleAddOption}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md bg-secondary px-3 py-2 text-sm hover:bg-secondary/80"
                >
                  <Plus className="h-3.5 w-3.5" /> Adicionar
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {field.base_options
                  .sort((a, b) => a.display_order - b.display_order)
                  .map((option) => (
                    <OptionRow
                      key={option.id}
                      option={option}
                      onToggle={(id, active) => onToggleOption(field.id, id, active)}
                      onRemove={(id) => onRemoveOption(field.id, id)}
                    />
                  ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
});

// ---- Componente principal ----
export function BaseManager({
  projectId = null,
  title,
  description,
}: {
  projectId?: string | null;
  title: string;
  description: string;
}) {
  const [fields, setFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState(true);
  const [newLabel, setNewLabel] = useState<Record<string, string>>({});
  // Referência para manter projectId estável no load
  const projectIdRef = useRef(projectId);
  projectIdRef.current = projectId;

  const load = useCallback(async () => {
    // Sem setLoading(true) aqui para não re-montar tudo após criação de campo
    let query = supabase.from("base_fields").select("*,base_options(*)").order("display_order");
    query = projectIdRef.current
      ? query.eq("project_id", projectIdRef.current)
      : query.is("project_id", null);
    const { data, error } = await query;
    if (error) toast.error(error.message);
    setFields((data ?? []) as Field[]);
  }, []);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [projectId, load]);

  // Atualiza só o campo alterado no estado local — sem buscar o banco
  const patchLocal = useCallback((id: string, patch: Partial<Field>) =>
    setFields((cur) => cur.map((f) => (f.id === id ? { ...f, ...patch } : f))), []);

  const save = useCallback(async (field: Field) => {
    const { base_options: _options, ...payload } = field;
    const { error } = await supabase.from("base_fields").update(payload).eq("id", field.id);
    if (error) toast.error(error.message);
    else toast.success("Campo atualizado");
  }, []);

  const addField = useCallback(async (sectionKey: string) => {
    const label = (newLabel[sectionKey] ?? "").trim();
    if (!label) return;
    const sectionFields = fields.filter((f) => f.section === sectionKey);
    const fieldKey = `${slugify(label)}_${Date.now()}`;
    const { data, error } = await supabase
      .from("base_fields")
      .insert({
        project_id: projectIdRef.current,
        field_key: fieldKey,
        label,
        section: sectionKey,
        field_type: "text",
        display_order: sectionFields.length * 10 + 10,
      })
      .select("*,base_options(*)")
      .single();
    if (error) return toast.error(error.message);
    // Adiciona localmente sem reload — evita scroll para o topo
    setFields((cur) => [...cur, data as Field]);
    setNewLabel((prev) => ({ ...prev, [sectionKey]: "" }));
    toast.success("Campo criado");
  }, [fields, newLabel]);

  const removeField = useCallback(async (id: string) => {
    if (!confirm("Excluir este campo e todas as opções?")) return;
    const { error } = await supabase.from("base_fields").delete().eq("id", id);
    if (error) return toast.error(error.message);
    // Remove localmente sem reload
    setFields((cur) => cur.filter((f) => f.id !== id));
    toast.success("Campo excluído");
  }, []);

  const addOption = useCallback(async (fieldId: string, label: string) => {
    const field = fields.find((f) => f.id === fieldId);
    if (!field) return;
    const value = `${slugify(label)}_${Date.now()}`;
    const { data, error } = await supabase
      .from("base_options")
      .insert({
        field_id: fieldId,
        label: label.trim(),
        value,
        display_order: field.base_options.length * 10 + 10,
      })
      .select("*")
      .single();
    if (error) return toast.error(error.message);
    // Adiciona opção localmente sem reload
    setFields((cur) =>
      cur.map((f) =>
        f.id === fieldId ? { ...f, base_options: [...f.base_options, data as Option] } : f
      )
    );
  }, [fields]);

  const toggleOption = useCallback(async (fieldId: string, optionId: string, active: boolean) => {
    const { error } = await supabase
      .from("base_options")
      .update({ is_active: active })
      .eq("id", optionId);
    if (error) return toast.error(error.message);
    // Atualiza localmente sem reload
    setFields((cur) =>
      cur.map((f) =>
        f.id === fieldId
          ? { ...f, base_options: f.base_options.map((o) => o.id === optionId ? { ...o, is_active: active } : o) }
          : f
      )
    );
  }, []);

  const removeOption = useCallback(async (fieldId: string, optionId: string) => {
    const { error } = await supabase.from("base_options").delete().eq("id", optionId);
    if (error) return toast.error(error.message);
    // Remove localmente sem reload
    setFields((cur) =>
      cur.map((f) =>
        f.id === fieldId
          ? { ...f, base_options: f.base_options.filter((o) => o.id !== optionId) }
          : f
      )
    );
  }, []);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">Bases dinâmicas</p>
      <h1 className="mt-2 font-display text-4xl">{title}</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{description}</p>

      {loading ? (
        <p className="mt-8 text-sm text-muted-foreground">Carregando base...</p>
      ) : (
        <div className="mt-8 space-y-10">
          {DC_SECTIONS.map((section) => {
            const sectionFields = fields
              .filter((f) => f.section === section.key)
              .sort((a, b) => a.display_order - b.display_order);
            return (
              <section key={section.key} className="rounded-2xl border border-border bg-card p-6">
                <header className="mb-5 flex items-baseline justify-between gap-4 border-b border-border pb-4">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-accent">{section.num}</p>
                    <h2 className="mt-1 font-display text-2xl">{section.label}</h2>
                  </div>
                  <span className="text-xs text-muted-foreground">{sectionFields.length} campo(s)</span>
                </header>

                <div className="mb-5 flex gap-2">
                  <input
                    value={newLabel[section.key] ?? ""}
                    onChange={(e) =>
                      setNewLabel((prev) => ({ ...prev, [section.key]: e.target.value }))
                    }
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addField(section.key))}
                    className={inputClass}
                    placeholder={`Novo campo em ${section.label}`}
                  />
                  <button
                    type="button"
                    onClick={() => addField(section.key)}
                    className="inline-flex shrink-0 items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
                  >
                    <Plus className="h-4 w-4" /> Criar campo
                  </button>
                </div>

                {sectionFields.length === 0 ? (
                  <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    Nenhum campo neste bloco.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {sectionFields.map((field) => (
                      <FieldRow
                        key={field.id}
                        field={field}
                        onPatch={patchLocal}
                        onSave={save}
                        onRemove={removeField}
                        onAddOption={addOption}
                        onToggleOption={toggleOption}
                        onRemoveOption={removeOption}
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
