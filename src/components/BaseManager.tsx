import { useEffect, useState, useRef, useCallback, memo, type ReactNode } from "react";
import {
  ClipboardPaste,
  Copy,
  Plus,
  Save,
  Trash2,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
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
import { normalizeCoreFieldLabel, normalizeFieldDataSource } from "@/components/DynamicFields";
import { DC_SECTIONS } from "@/lib/dc-sections";
import { apiJson } from "@/lib/api";
import { canAccessSection, getCurrentUserPlan, SECTION_PLAN_LABELS } from "@/lib/section-access";

type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "checkbox"
  | "single_select"
  | "multi_select"
  | "competency_description";
type Option = {
  id: string;
  label: string;
  value: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
};
type DataSource = "manual" | "areas" | "setores";
type Field = {
  id: string;
  field_key: string;
  label: string;
  section: string;
  field_type: FieldType;
  is_required: boolean;
  display_order: number;
  allows_multiple: boolean;
  allows_free_text: boolean;
  is_active: boolean;
  data_source: DataSource;
  base_options: Option[];
};
type SectionSetting = { id: string | null; section: string; max_items: number; is_enabled: boolean };

const inputClass =
  "w-full rounded-lg border border-[#042558]/20 bg-white/50 px-3 py-2 text-sm text-[#042558] outline-none transition-all focus:border-[#042558] focus:ring-2 focus:ring-[#042558]/20 placeholder:text-[#042558]/40";

const types: Array<{ value: FieldType; label: string }> = [
  { value: "text", label: "Texto" },
  { value: "textarea", label: "Texto longo" },
  { value: "number", label: "Número" },
  { value: "date", label: "Data" },
  { value: "checkbox", label: "Sim/Não" },
  { value: "single_select", label: "Seleção única" },
  { value: "multi_select", label: "Seleção múltipla" },
  { value: "competency_description", label: "Competência + Descrição" },
];

const slugify = (raw: string) =>
  raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

const sectionDropId = (sectionKey: string) => `section:${sectionKey}`;

const isProjectAreaSource = (field: Field) =>
  field.data_source === "areas" || field.data_source === "setores";

const normalizeField = (field: Field): Field => {
  const dataSource = normalizeFieldDataSource(field);
  return {
    ...field,
    label: normalizeCoreFieldLabel(field),
    data_source: dataSource,
  };
};

const OptionRow = memo(function OptionRow({
  option,
  showDescription,
  onToggle,
  onRemove,
  onDescriptionChange,
}: {
  option: Option;
  showDescription: boolean;
  onToggle: (id: string, active: boolean) => void;
  onRemove: (id: string) => void;
  onDescriptionChange: (id: string, description: string) => void;
}) {
  const [localDesc, setLocalDesc] = useState(option.description ?? "");
  useEffect(() => {
    setLocalDesc(option.description ?? "");
  }, [option.description]);

  if (showDescription) {
    return (
      <div
        className={`flex items-start gap-2 rounded-lg border p-3 ${option.is_active ? "border-[#042558]/20 bg-white/60" : "border-dashed border-[#042558]/10 bg-white/30 opacity-60"}`}
      >
        <button
          type="button"
          onClick={() => onToggle(option.id, !option.is_active)}
          className="min-w-[140px] truncate text-left text-sm font-medium text-[#042558] hover:text-[#042558]/80 hover:underline"
        >
          {option.label}
        </button>
        <input
          value={localDesc}
          onChange={(e) => setLocalDesc(e.target.value)}
          onBlur={() =>
            localDesc !== (option.description ?? "") && onDescriptionChange(option.id, localDesc)
          }
          placeholder="Descrição da competência"
          className={inputClass}
        />
        <button
          type="button"
          onClick={() => onRemove(option.id)}
          aria-label="Excluir"
          className="shrink-0 rounded-md p-2 text-[#042558]/40 transition-colors hover:bg-red-50 hover:text-red-600"
        >
          ×
        </button>
      </div>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${option.is_active ? "border-[#042558]/20 bg-white/60 text-[#042558]" : "border-dashed border-[#042558]/10 bg-white/30 text-[#042558]/40"}`}
    >
      <button
        type="button"
        onClick={() => onToggle(option.id, !option.is_active)}
        className="hover:text-[#042558]"
      >
        {option.label}
      </button>
      <button
        type="button"
        onClick={() => onRemove(option.id)}
        aria-label="Excluir opção"
        className="text-[#042558]/40 transition-colors hover:text-red-600"
      >
        ×
      </button>
    </span>
  );
});

const SortableFieldRow = memo(function SortableFieldRow(props: {
  field: Field;
  onPatch: (id: string, patch: Partial<Field>) => void;
  onSave: (field: Field) => void;
  onCopy: (field: Field) => void;
  onRemove: (id: string) => void;
  onAddOption: (fieldId: string, label: string) => void;
  onToggleOption: (fieldId: string, optionId: string, active: boolean) => void;
  onRemoveOption: (fieldId: string, optionId: string) => void;
  onUpdateOptionDescription: (fieldId: string, optionId: string, description: string) => void;
}) {
  const {
    field,
    onPatch,
    onSave,
    onCopy,
    onRemove,
    onAddOption,
    onToggleOption,
    onRemoveOption,
    onUpdateOptionDescription,
  } = props;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
  });
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [newOptionLabel, setNewOptionLabel] = useState("");
  const showOptions =
    !isProjectAreaSource(field) &&
    (field.field_type === "single_select" ||
      field.field_type === "multi_select" ||
      field.field_type === "competency_description");
  const showDescription = field.field_type === "competency_description";

  const handleAddOption = () => {
    const label = newOptionLabel.trim();
    if (!label) return;
    onAddOption(field.id, label);
    setNewOptionLabel("");
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-xl border border-[#042558]/10 bg-white/60 p-4 shadow-sm transition-all hover:border-[#042558]/30 hover:shadow-md"
    >
      <div className="grid gap-3 md:grid-cols-[auto_1.8fr_1fr_auto]">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="flex cursor-grab items-center justify-center rounded-lg border border-[#042558]/20 bg-white/50 px-2 transition-colors hover:bg-[#042558]/10 active:cursor-grabbing"
          title="Arrastar para reordenar"
        >
          <GripVertical className="h-4 w-4 text-[#042558]/40" />
        </button>
        <input
          value={field.label}
          onChange={(e) => onPatch(field.id, { label: e.target.value })}
          className={inputClass}
          aria-label="Nome do campo"
        />
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
          {types.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => onCopy(field)}
            className="rounded-lg border border-[#042558]/20 bg-white/50 p-2 text-[#042558] transition-colors hover:bg-[#042558] hover:text-white hover:shadow-lg hover:shadow-[#042558]/20"
            title="Copiar campo"
          >
            <Copy className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onSave(field)}
            className="rounded-lg border border-[#042558]/20 bg-white/50 p-2 text-[#042558] transition-colors hover:bg-[#042558] hover:text-white hover:shadow-lg hover:shadow-[#042558]/20"
            title="Salvar"
          >
            <Save className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onRemove(field.id)}
            className="rounded-lg border border-[#042558]/20 bg-white/50 p-2 text-[#042558]/40 transition-colors hover:border-red-500 hover:bg-red-50 hover:text-red-600"
            title="Excluir"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-5 text-sm">
        <label className="flex cursor-pointer items-center gap-1.5 text-[#042558]/60 transition-colors hover:text-[#042558]">
          <input
            type="checkbox"
            checked={field.is_required}
            onChange={(e) => onPatch(field.id, { is_required: e.target.checked })}
            className="rounded border-[#042558]/30 text-[#042558] focus:ring-[#042558]/20"
          />{" "}
          Obrigatório
        </label>
        <label className="flex cursor-pointer items-center gap-1.5 text-[#042558]/60 transition-colors hover:text-[#042558]">
          <input
            type="checkbox"
            checked={field.is_active}
            onChange={(e) => onPatch(field.id, { is_active: e.target.checked })}
            className="rounded border-[#042558]/30 text-[#042558] focus:ring-[#042558]/20"
          />{" "}
          Ativo
        </label>
      </div>

      {isProjectAreaSource(field) && (
        <div className="mt-4 rounded-lg border border-[#042558]/10 bg-[#042558]/5 px-3 py-2 text-xs font-medium text-[#042558]/60">
          As opções deste campo vêm do cadastro de{" "}
          {field.data_source === "areas" ? "Áreas" : "Setores"} do projeto.
        </div>
      )}

      {showOptions && (
        <div className="mt-4 border-t border-[#042558]/10 pt-4">
          <button
            type="button"
            onClick={() => setOptionsOpen((v) => !v)}
            className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-[#042558]/50 transition-colors hover:text-[#042558]"
          >
            Opções ({field.base_options.length})
            {optionsOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>

          {optionsOpen && (
            <>
              <div className="mb-3 flex gap-2">
                <input
                  value={newOptionLabel}
                  onChange={(e) => setNewOptionLabel(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddOption())}
                  placeholder={showDescription ? "Nova competência..." : "Nova opção..."}
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={handleAddOption}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#042558]/20 bg-white/60 px-3 py-2 text-sm font-medium text-[#042558] transition-all hover:bg-[#042558] hover:text-white hover:shadow-lg hover:shadow-[#042558]/20"
                >
                  <Plus className="h-3.5 w-3.5" /> Adicionar
                </button>
              </div>
              <div className={showDescription ? "space-y-2" : "flex flex-wrap gap-2"}>
                {field.base_options
                  .sort((a, b) => a.display_order - b.display_order)
                  .map((option) => (
                    <OptionRow
                      key={option.id}
                      option={option}
                      showDescription={showDescription}
                      onToggle={(id, active) => onToggleOption(field.id, id, active)}
                      onRemove={(id) => onRemoveOption(field.id, id)}
                      onDescriptionChange={(id, description) =>
                        onUpdateOptionDescription(field.id, id, description)
                      }
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

const SectionDropZone = memo(function SectionDropZone({
  sectionKey,
  children,
}: {
  sectionKey: string;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: sectionDropId(sectionKey) });

  return (
    <div ref={setNodeRef} className={`p-5 transition-colors ${isOver ? "bg-[#042558]/5" : ""}`}>
      {children}
    </div>
  );
});

export function BaseManager({
  projectId = null,
  title,
  description,
  embedded = false,
}: {
  projectId?: string | null;
  title: string;
  description: string;
  embedded?: boolean;
}) {
  const [fields, setFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState(true);
  const [newLabel, setNewLabel] = useState<Record<string, string>>({});
  const [copiedField, setCopiedField] = useState<Field | null>(null);
  const [sectionLimits, setSectionLimits] = useState<
    Record<string, { id: string | null; max_items: number }>
  >({});
  const [sectionEnabled, setSectionEnabled] = useState<
    Record<string, { id: string | null; is_enabled: boolean }>
  >({});
  const projectIdRef = useRef(projectId);
  projectIdRef.current = projectId;
  const fieldsRef = useRef<Field[]>([]);
  const newLabelRef = useRef<Record<string, string>>({});
  const sectionLimitsRef = useRef<Record<string, { id: string | null; max_items: number }>>({});
  const sectionEnabledRef = useRef<Record<string, { id: string | null; is_enabled: boolean }>>({});
  fieldsRef.current = fields;
  newLabelRef.current = newLabel;
  sectionLimitsRef.current = sectionLimits;
  sectionEnabledRef.current = sectionEnabled;
  const currentPlan = getCurrentUserPlan();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const load = useCallback(async () => {
    const queryString = projectIdRef.current
      ? `?projectId=${encodeURIComponent(projectIdRef.current)}`
      : "";
    const payload = await apiJson<{
      ok: boolean;
      fields: Field[];
      sectionSettings: SectionSetting[];
    }>(`/api/base${queryString}`);
    setFields(payload.fields.map(normalizeField));

    const limitsData = payload.sectionSettings;
    const limitsMap: Record<string, { id: string | null; max_items: number }> = {};
    const enabledMap: Record<string, { id: string | null; is_enabled: boolean }> = {};
    DC_SECTIONS.forEach((section) => {
      const existing = limitsData.find((row) => row.section === section.key);
      limitsMap[section.key] = { id: existing?.id ?? null, max_items: existing?.max_items ?? 3 };
      enabledMap[section.key] = {
        id: existing?.id ?? null,
        is_enabled: existing?.is_enabled ?? true,
      };
    });
    setSectionLimits(limitsMap);
    setSectionEnabled(enabledMap);
  }, []);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : "Erro ao carregar base");
      })
      .finally(() => setLoading(false));
  }, [projectId, load]);

  const patchLocal = useCallback(
    (id: string, patch: Partial<Field>) =>
      setFields((cur) =>
        cur.map((f) => {
          if (f.id !== id) return f;
          const next = normalizeField({ ...f, ...patch });
          return isProjectAreaSource(next) ? { ...next, field_type: "single_select" } : next;
        }),
      ),
    [],
  );

  const save = useCallback(async (field: Field) => {
    const normalized = normalizeField(field);
    const savedField = isProjectAreaSource(normalized)
      ? { ...normalized, field_type: "single_select" as FieldType }
      : normalized;
    const { base_options: _options, ...payload } = savedField;
    try {
      await apiJson(`/api/base/fields/${field.id}`, { method: "PATCH", body: payload });
      toast.success("Campo atualizado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao atualizar campo");
    }
  }, []);

  const addField = useCallback(async (sectionKey: string) => {
    const label = (newLabelRef.current[sectionKey] ?? "").trim();
    if (!label) return;
    const sectionFields = fieldsRef.current.filter((f) => f.section === sectionKey);
    const fieldKey = `${slugify(label)}_${Date.now()}`;
    const dataSource = normalizeFieldDataSource({ field_key: fieldKey, label });
    try {
      const payload = await apiJson<{ ok: boolean; field: Field }>("/api/base/fields", {
        method: "POST",
        body: {
          projectId: projectIdRef.current,
          field: {
            field_key: fieldKey,
            label,
            section: sectionKey,
            field_type: dataSource === "manual" ? "text" : "single_select",
            display_order: sectionFields.length * 10 + 10,
            data_source: dataSource,
          },
        },
      });
      setFields((cur) => [...cur, normalizeField(payload.field)]);
      setNewLabel((prev) => ({ ...prev, [sectionKey]: "" }));
      toast.success("Campo criado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao criar campo");
    }
  }, []);

  const copyField = useCallback((field: Field) => {
    setCopiedField({ ...field, base_options: [...field.base_options] });
    toast.success(`Campo "${field.label}" copiado`);
  }, []);

  const pasteCopiedField = useCallback(
    async (sectionKey: string) => {
      const field = copiedField;
      if (!field) return;
      const sectionFields = fieldsRef.current
        .filter((f) => f.section === sectionKey)
        .sort((a, b) => a.display_order - b.display_order);
      const insertIndex = sectionFields.length;
      const nextLabel = `${field.label} (cópia)`;
      const fieldKey = `${slugify(field.label || "campo")}_copia_${Date.now()}`;

      const sortedOptions = [...field.base_options].sort(
        (a, b) => a.display_order - b.display_order,
      );
      let createdField: Field;
      let createdOptions: Option[];
      try {
        const createdPayload = await apiJson<{ ok: boolean; field: Field }>("/api/base/fields", {
          method: "POST",
          body: {
            projectId: projectIdRef.current,
            field: {
              field_key: fieldKey,
              label: nextLabel,
              section: sectionKey,
              field_type: field.field_type,
              is_required: field.is_required,
              display_order: (insertIndex + 1) * 10,
              allows_multiple: field.allows_multiple,
              allows_free_text: field.allows_free_text,
              is_active: field.is_active,
              data_source: "manual",
            },
            options: sortedOptions.map((option, index) => ({
              label: option.label,
              value: `${slugify(option.label || "opcao")}_${Date.now()}_${index}`,
              description: option.description,
              display_order: (index + 1) * 10,
              is_active: option.is_active,
            })),
          },
        });
        createdField = normalizeField(createdPayload.field);
        createdOptions = createdField.base_options;
      } catch (error) {
        return toast.error(error instanceof Error ? error.message : "Erro ao copiar campo");
      }

      const reordered = [...sectionFields];
      reordered.splice(insertIndex, 0, {
        ...createdField,
        base_options: createdOptions,
      });
      const orderUpdates = reordered.map((item, index) => ({
        id: item.id,
        section: sectionKey,
        display_order: (index + 1) * 10,
      }));

      setFields((cur) => {
        const created = { ...createdField, base_options: createdOptions };
        return [...cur.filter((item) => item.id !== createdField.id), created].map((item) => {
          const update = orderUpdates.find((order) => order.id === item.id);
          return update ? { ...item, display_order: update.display_order } : item;
        });
      });

      try {
        await apiJson("/api/base/fields/order", { method: "PATCH", body: { updates: orderUpdates } });
      } catch (error) {
        return toast.error(error instanceof Error ? error.message : "Erro ao reordenar campos");
      }

      toast.success("Campo copiado com opções");
    },
    [copiedField],
  );

  const removeField = useCallback(async (id: string) => {
    if (!confirm("Excluir este campo e todas as opções?")) return;
    try {
      await apiJson(`/api/base/fields/${id}`, { method: "DELETE" });
    } catch (error) {
      return toast.error(error instanceof Error ? error.message : "Erro ao excluir campo");
    }
    setFields((cur) => cur.filter((f) => f.id !== id));
    toast.success("Campo excluído");
  }, []);

  const saveSectionLimit = useCallback(async (sectionKey: string, maxItems: number) => {
    const safeValue = Number.isFinite(maxItems) && maxItems >= 1 ? Math.floor(maxItems) : 1;
    const existing = sectionLimitsRef.current[sectionKey];
    const isEnabled = sectionEnabledRef.current[sectionKey]?.is_enabled ?? true;
    setSectionLimits((cur) => ({
      ...cur,
      [sectionKey]: { id: existing?.id ?? null, max_items: safeValue },
    }));
    try {
      const payload = await apiJson<{ ok: boolean; setting: SectionSetting }>("/api/base/sections", {
        method: "PUT",
        body: {
          projectId: projectIdRef.current,
          section: sectionKey,
          max_items: safeValue,
          is_enabled: isEnabled,
        },
      });
      setSectionLimits((cur) => ({
        ...cur,
        [sectionKey]: { id: payload.setting.id, max_items: safeValue },
      }));
      setSectionEnabled((cur) => ({
        ...cur,
        [sectionKey]: { id: payload.setting.id, is_enabled: isEnabled },
      }));
    } catch (error) {
      return toast.error(error instanceof Error ? error.message : "Erro ao atualizar limite");
    }
    toast.success("Limite de itens atualizado");
  }, []);

  const saveSectionEnabled = useCallback(async (sectionKey: string, is_enabled: boolean) => {
    const existing = sectionEnabledRef.current[sectionKey];
    setSectionEnabled((cur) => ({
      ...cur,
      [sectionKey]: { id: existing?.id ?? null, is_enabled },
    }));

    const maxItems = sectionLimitsRef.current[sectionKey]?.max_items ?? 3;
    try {
      const payload = await apiJson<{ ok: boolean; setting: SectionSetting }>("/api/base/sections", {
        method: "PUT",
        body: {
          projectId: projectIdRef.current,
          section: sectionKey,
          max_items: maxItems,
          is_enabled,
        },
      });
      setSectionEnabled((cur) => ({
        ...cur,
        [sectionKey]: { id: payload.setting.id, is_enabled },
      }));
      setSectionLimits((cur) => ({
        ...cur,
        [sectionKey]: { id: payload.setting.id, max_items: maxItems },
      }));
    } catch (error) {
      return toast.error(error instanceof Error ? error.message : "Erro ao atualizar bloco");
    }
    toast.success(is_enabled ? "Bloco habilitado" : "Bloco desabilitado");
  }, []);

  const addOption = useCallback(async (fieldId: string, label: string) => {
    const field = fieldsRef.current.find((f) => f.id === fieldId);
    if (!field) return;
    const value = `${slugify(label)}_${Date.now()}`;
    let option: Option;
    try {
      const payload = await apiJson<{ ok: boolean; option: Option }>("/api/base/options", {
        method: "POST",
        body: {
          fieldId,
          label: label.trim(),
          value,
          display_order: field.base_options.length * 10 + 10,
        },
      });
      option = payload.option;
    } catch (error) {
      return toast.error(error instanceof Error ? error.message : "Erro ao criar opcao");
    }
    setFields((cur) =>
      cur.map((f) =>
        f.id === fieldId ? { ...f, base_options: [...f.base_options, option] } : f,
      ),
    );
  }, []);

  const toggleOption = useCallback(async (fieldId: string, optionId: string, active: boolean) => {
    try {
      await apiJson(`/api/base/options/${optionId}`, {
        method: "PATCH",
        body: { is_active: active },
      });
    } catch (error) {
      return toast.error(error instanceof Error ? error.message : "Erro ao atualizar opcao");
    }
    setFields((cur) =>
      cur.map((f) =>
        f.id === fieldId
          ? {
              ...f,
              base_options: f.base_options.map((o) =>
                o.id === optionId ? { ...o, is_active: active } : o,
              ),
            }
          : f,
      ),
    );
  }, []);

  const removeOption = useCallback(async (fieldId: string, optionId: string) => {
    try {
      await apiJson(`/api/base/options/${optionId}`, { method: "DELETE" });
    } catch (error) {
      return toast.error(error instanceof Error ? error.message : "Erro ao excluir opcao");
    }
    setFields((cur) =>
      cur.map((f) =>
        f.id === fieldId
          ? { ...f, base_options: f.base_options.filter((o) => o.id !== optionId) }
          : f,
      ),
    );
  }, []);

  const updateOptionDescription = useCallback(
    async (fieldId: string, optionId: string, description: string) => {
      try {
        await apiJson(`/api/base/options/${optionId}`, {
          method: "PATCH",
          body: { description },
        });
      } catch (error) {
        return toast.error(error instanceof Error ? error.message : "Erro ao atualizar descricao");
      }
      setFields((cur) =>
        cur.map((f) =>
          f.id === fieldId
            ? {
                ...f,
                base_options: f.base_options.map((o) =>
                  o.id === optionId ? { ...o, description } : o,
                ),
              }
            : f,
        ),
      );
    },
    [],
  );

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    const activeField = fieldsRef.current.find((f) => f.id === activeId);
    if (!activeField) return;

    const overField = fieldsRef.current.find((f) => f.id === overId);
    const targetSection = overId.startsWith("section:")
      ? overId.replace(/^section:/, "")
      : overField?.section;
    if (!targetSection) return;

    const sourceSection = activeField.section;
    const sourceFields = fieldsRef.current
      .filter((f) => f.section === sourceSection)
      .sort((a, b) => a.display_order - b.display_order);
    const targetFields = fieldsRef.current
      .filter((f) => f.section === targetSection && f.id !== activeId)
      .sort((a, b) => a.display_order - b.display_order);

    if (sourceSection === targetSection && overField) {
      const oldIndex = sourceFields.findIndex((f) => f.id === activeId);
      const newIndex = sourceFields.findIndex((f) => f.id === overId);
      if (oldIndex < 0 || newIndex < 0) return;
      const reordered = arrayMove(sourceFields, oldIndex, newIndex);
      const updates = reordered.map((f, i) => ({
        id: f.id,
        section: targetSection,
        display_order: (i + 1) * 10,
      }));
      setFields((cur) =>
        cur.map((f) => {
          const u = updates.find((x) => x.id === f.id);
          return u ? { ...f, section: u.section, display_order: u.display_order } : f;
        }),
      );
      try {
        await apiJson("/api/base/fields/order", { method: "PATCH", body: { updates } });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Erro ao reordenar campos");
      }
      return;
    }

    const targetIndex = overField
      ? Math.max(
          0,
          targetFields.findIndex((f) => f.id === overId),
        )
      : targetFields.length;
    const nextTargetFields = [...targetFields];
    nextTargetFields.splice(targetIndex, 0, { ...activeField, section: targetSection });

    const sourceUpdates =
      sourceSection === targetSection
        ? []
        : sourceFields
            .filter((f) => f.id !== activeId)
            .map((f, i) => ({ id: f.id, section: sourceSection, display_order: (i + 1) * 10 }));
    const targetUpdates = nextTargetFields.map((f, i) => ({
      id: f.id,
      section: targetSection,
      display_order: (i + 1) * 10,
    }));
    const updates = [...sourceUpdates, ...targetUpdates];

    // Optimistic update
    setFields((cur) =>
      cur.map((f) => {
        const u = updates.find((x) => x.id === f.id);
        return u ? { ...f, section: u.section, display_order: u.display_order } : f;
      }),
    );
    // Persist
    try {
      await apiJson("/api/base/fields/order", { method: "PATCH", body: { updates } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao reordenar campos");
    }
  }, []);

  return (
    <main
      className={
        embedded
          ? ""
          : "min-h-screen bg-gradient-to-br from-[#042558]/5 via-white to-[#042558]/5 px-6 py-8"
      }
    >
      <div className={embedded ? "" : "mx-auto max-w-6xl"}>
        {/* Header */}
        <div className="mb-8 rounded-2xl border border-[#042558]/10 bg-white/80 p-6 shadow-sm backdrop-blur-sm">
          <div className="flex items-start gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#042558]">{title}</h1>
              <p className="mt-1 text-sm text-[#042558]/60">{description}</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex h-64 items-center justify-center rounded-2xl border border-[#042558]/10 bg-white/60">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#042558] border-t-transparent" />
              <p className="text-sm text-[#042558]/60">Carregando base...</p>
            </div>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <div className="space-y-8">
              {DC_SECTIONS.map((section) => {
                const sectionFields = fields
                  .filter((f) => f.section === section.key)
                  .sort((a, b) => a.display_order - b.display_order);
                const planAllowed = canAccessSection(section.key, currentPlan);
                const isSectionEnabled = sectionEnabled[section.key]?.is_enabled ?? true;
                return (
                  <section
                    key={section.key}
                    className="overflow-hidden rounded-2xl border border-[#042558]/10 bg-white/60 shadow-sm backdrop-blur-sm transition-all hover:shadow-md"
                  >
                    <div className="border-b border-[#042558]/10 bg-[#042558]/5 p-5">
                      <div className="flex items-baseline justify-between gap-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-[#042558]/50">
                            Bloco {section.num}
                          </p>
                          <h2 className="text-xl font-bold text-[#042558]">{section.label}</h2>
                          <p className="mt-0.5 text-xs text-[#042558]/40">
                            Arraste os campos pela alça <GripVertical className="inline h-3 w-3" />{" "}
                            para reordenar ou mover entre blocos
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-3">
                          <label
                            className={`flex items-center gap-2 text-xs font-medium ${planAllowed ? "text-[#042558]/60" : "text-[#042558]/35"}`}
                          >
                            <input
                              type="checkbox"
                              checked={isSectionEnabled}
                              onChange={() => saveSectionEnabled(section.key, !isSectionEnabled)}
                              disabled={!planAllowed}
                              className="rounded border-[#042558]/30 text-[#042558] focus:ring-[#042558]/20 disabled:cursor-not-allowed"
                            />
                            {isSectionEnabled ? "Ativo" : "Inativo"}
                          </label>
                          {section.repeater && (
                            <label className="flex items-center gap-2 text-xs font-medium text-[#042558]/60">
                              Limite de itens do bloco:
                              <input
                                type="number"
                                min={1}
                                value={sectionLimits[section.key]?.max_items ?? 3}
                                onChange={(e) =>
                                  setSectionLimits((cur) => ({
                                    ...cur,
                                    [section.key]: {
                                      id: cur[section.key]?.id ?? null,
                                      max_items: Number(e.target.value),
                                    },
                                  }))
                                }
                                onBlur={(e) =>
                                  saveSectionLimit(section.key, Number(e.target.value))
                                }
                                className="w-16 rounded-lg border border-[#042558]/20 bg-white/50 px-2 py-1 text-center text-sm text-[#042558] outline-none transition-all focus:border-[#042558] focus:ring-2 focus:ring-[#042558]/20"
                                title="Quantas vezes as pessoas podem clicar em '+' neste bloco ao preencher a descrição de cargo. O primeiro item sempre aparece por padrão."
                              />
                            </label>
                          )}
                          {!planAllowed && (
                            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                              Bloqueado no plano {SECTION_PLAN_LABELS[currentPlan]}
                            </span>
                          )}
                          <span className="rounded-full bg-[#042558]/10 px-3 py-1 text-xs font-medium text-[#042558]">
                            {sectionFields.length} campo{sectionFields.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>
                    </div>

                    <SectionDropZone sectionKey={section.key}>
                      <div className="mb-4 flex gap-2">
                        <input
                          value={newLabel[section.key] ?? ""}
                          onChange={(e) =>
                            setNewLabel((prev) => ({ ...prev, [section.key]: e.target.value }))
                          }
                          onKeyDown={(e) =>
                            e.key === "Enter" && (e.preventDefault(), addField(section.key))
                          }
                          className={inputClass}
                          placeholder={`Novo campo em ${section.label}`}
                        />
                        <button
                          type="button"
                          onClick={() => addField(section.key)}
                          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[#042558] px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-[#042558]/20 transition-all hover:bg-[#042558]/90 hover:shadow-xl hover:shadow-[#042558]/30"
                        >
                          <Plus className="h-4 w-4" /> Criar campo
                        </button>
                        {copiedField && (
                          <button
                            type="button"
                            onClick={() => pasteCopiedField(section.key)}
                            className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-[#042558]/20 bg-white/70 px-4 py-2.5 text-sm font-medium text-[#042558] transition-all hover:bg-[#042558] hover:text-white hover:shadow-lg hover:shadow-[#042558]/20"
                            title={`Colar "${copiedField.label}" neste bloco`}
                          >
                            <ClipboardPaste className="h-4 w-4" /> Colar campo
                          </button>
                        )}
                      </div>

                      {sectionFields.length === 0 ? (
                        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#042558]/20 p-8">
                          <Layers className="mb-2 h-8 w-8 text-[#042558]/20" />
                          <p className="text-sm font-medium text-[#042558]/40">
                            Nenhum campo neste bloco
                          </p>
                          <p className="text-xs text-[#042558]/30">Crie seu primeiro campo acima</p>
                        </div>
                      ) : (
                        <SortableContext
                          items={sectionFields.map((f) => f.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          <div className="space-y-3">
                            {sectionFields.map((field) => (
                              <SortableFieldRow
                                key={field.id}
                                field={field}
                                onPatch={patchLocal}
                                onSave={save}
                                onCopy={copyField}
                                onRemove={removeField}
                                onAddOption={addOption}
                                onToggleOption={toggleOption}
                                onRemoveOption={removeOption}
                                onUpdateOptionDescription={updateOptionDescription}
                              />
                            ))}
                          </div>
                        </SortableContext>
                      )}
                    </SectionDropZone>
                  </section>
                );
              })}
            </div>
          </DndContext>
        )}
      </div>
    </main>
  );
}
