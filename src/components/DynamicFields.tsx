import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DC_SECTIONS } from "@/lib/dc-sections";

export type DataSource = "manual" | "areas" | "setores";

export type ProjectArea = {
  id: string;
  parent_id: string | null;
  nome: string;
  cor: string | null;
};

export type DynamicField = {
  id: string;
  field_key: string;
  label: string;
  section: string;
  field_type:
    | "text"
    | "textarea"
    | "number"
    | "date"
    | "checkbox"
    | "single_select"
    | "multi_select"
    | "competency_description";
  is_required: boolean;
  allows_free_text: boolean;
  data_source: DataSource;
  options: Array<{ id: string; label: string; value: string; description: string | null }>;
};

const controlClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-ring";

function normalizeProjectAreaName(raw: string) {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function resolveProjectAreaValue(
  value: string | number | boolean | string[] | undefined,
  options: ProjectArea[],
) {
  if (typeof value !== "string" || !value) return "";
  const direct = options.find((area) => area.id === value);
  if (direct) return direct.id;
  const byName = options.find(
    (area) => normalizeProjectAreaName(area.nome) === normalizeProjectAreaName(value),
  );
  return byName?.id ?? "";
}

export function normalizeFieldDataSource(field: {
  field_key: string;
  label: string;
  data_source?: string | null;
}): DataSource {
  const key = field.field_key.toLowerCase();
  const label = field.label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (key === "nivelamento") return "manual";
  if (key === "unidade_negocio" || key === "area" || label === "area") return "areas";
  if (key === "departamento" || key === "setor" || label === "setor") return "setores";
  return "manual";
}

export function normalizeCoreFieldLabel(field: { field_key: string; label: string }) {
  switch (field.field_key.toLowerCase()) {
    case "cargo":
      return "Nomenclatura do cargo visivel";
    case "unidade_negocio":
    case "area":
      return "Area";
    case "departamento":
    case "setor":
      return "Setor";
    case "superior_imediato":
      return "Cargo do superior imediato";
    default:
      return field.label;
  }
}

function normalizeText(raw: string) {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function semanticFieldKey(field: { field_key: string; label: string }) {
  const key = field.field_key.toLowerCase();
  const label = normalizeText(field.label);
  if (key === "cargo" || label === "nomenclatura do cargo visivel") return "cargo";
  if (key === "superior_imediato" || label === "cargo do superior imediato")
    return "superior_imediato";
  if (key === "nivelamento") return "nivelamento";
  if (key === "unidade_negocio" || key === "area" || label === "area") return "area";
  if (key === "departamento" || key === "setor" || label === "setor") return "setor";
  return key;
}

function dedupeFields<T extends { field_key: string; label: string; section: string }>(
  fields: T[],
) {
  const seen = new Set<string>();
  return fields.filter((field) => {
    const semanticKey = `${field.section ?? ""}:${semanticFieldKey(field)}`;
    if (seen.has(semanticKey)) return false;
    seen.add(semanticKey);
    return true;
  });
}

export function useProjectFields(projectId: string) {
  const [fields, setFields] = useState<DynamicField[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    supabase
      .from("base_fields")
      .select(
        "id,field_key,label,section,field_type,is_required,allows_free_text,data_source,display_order,base_options(id,label,value,description,is_active,display_order)",
      )
      .eq("project_id", projectId)
      .eq("is_active", true)
      .order("display_order")
      .then(({ data }) => {
        setFields(
          dedupeFields(data ?? []).map((field) => ({
            ...field,
            label: normalizeCoreFieldLabel(field),
            data_source: normalizeFieldDataSource(field),
            options: (field.base_options ?? [])
              .filter((option) => option.is_active)
              .sort((a, b) => a.display_order - b.display_order)
              .map(({ id, label, value, description }) => ({
                id,
                label,
                value,
                description: description ?? null,
              })),
          })) as DynamicField[],
        );
        setLoading(false);
      });
  }, [projectId]);

  return { fields, loading };
}

// Limite de itens por bloco (repeater), configurado na Base do projeto.
// Se um bloco não tiver linha configurada, não há limite (retorna undefined).
const DEFAULT_REPEATER_LIMIT = 3;

export function useSectionLimits(projectId: string) {
  const [limits, setLimits] = useState<Record<string, number>>({});
  const [enabledSections, setEnabledSections] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    supabase
      .from("base_section_settings")
      .select("section,max_items,is_enabled")
      .eq("project_id", projectId)
      .then(({ data }) => {
        const map: Record<string, number> = {};
        const enabledMap: Record<string, boolean> = {};
        DC_SECTIONS.filter((section) => section.repeater).forEach((section) => {
          map[section.key] = DEFAULT_REPEATER_LIMIT;
        });
        (data ?? []).forEach((row) => {
          map[row.section] = row.max_items;
          enabledMap[row.section] = row.is_enabled ?? true;
        });
        setLimits(map);
        setEnabledSections(enabledMap);
        setLoading(false);
      });
  }, [projectId]);

  return { limits, enabledSections, loading };
}

export function useProjectAreas(projectId: string) {
  const [areas, setAreas] = useState<ProjectArea[]>([]);
  useEffect(() => {
    supabase
      .from("project_areas")
      .select("id,parent_id,nome,cor")
      .eq("project_id", projectId)
      .order("display_order")
      .order("created_at")
      .then(({ data, error }) => {
        if (error) {
          toast.error(error.message);
          setAreas([]);
          return;
        }
        setAreas((data ?? []) as ProjectArea[]);
      });
  }, [projectId]);
  return areas;
}

export function DynamicFieldControl({
  field,
  value,
  onChange,
  areas,
  parentAreaId,
  disabled,
}: {
  field: DynamicField;
  value: string | number | boolean | string[] | undefined;
  onChange: (value: string | number | boolean | string[]) => void;
  areas?: ProjectArea[];
  parentAreaId?: string | null;
  disabled?: boolean;
}) {
  const [localOptions, setLocalOptions] = useState(field.options);
  const [modalOpen, setModalOpen] = useState(false);
  const [newOptionLabel, setNewOptionLabel] = useState("");
  const [newOptionDescription, setNewOptionDescription] = useState("");
  const [savingOption, setSavingOption] = useState(false);
  const common = { required: field.is_required, className: controlClass, disabled };

  useEffect(() => {
    setLocalOptions(field.options);
  }, [field.options]);

  const slugify = (raw: string) =>
    raw
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");

  const handleAddOption = async () => {
    const label = newOptionLabel.trim();
    if (!label) return;

    setSavingOption(true);
    const valueKey = `${slugify(label)}_${Date.now()}`;
    const { data, error } = await supabase
      .from("base_options")
      .insert({
        field_id: field.id,
        label,
        value: valueKey,
        description:
          field.field_type === "competency_description"
            ? newOptionDescription.trim() || null
            : null,
        display_order: localOptions.length * 10 + 10,
        is_active: true,
      })
      .select("id,label,value,description")
      .single();

    setSavingOption(false);
    if (error) {
      toast.error(error.message);
      return;
    }

    const nextOption = {
      id: data.id,
      label: data.label,
      value: data.value,
      description: data.description ?? null,
    };
    setLocalOptions((prev) => [...prev, nextOption]);
    setNewOptionLabel("");
    setNewOptionDescription("");
    setModalOpen(false);
    toast.success("Opção adicionada à base do projeto");
  };

  const renderOptionAdder = () => {
    if (
      disabled ||
      !["single_select", "multi_select", "competency_description"].includes(field.field_type)
    )
      return null;

    return (
      <>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          title="Adicionar opção"
        >
          <Plus className="h-4 w-4" />
        </button>

        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Nova opção</DialogTitle>
              <DialogDescription>
                Cadastre uma nova opção para este campo e ela será salva na base do projeto.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Rótulo</label>
                <input
                  value={newOptionLabel}
                  onChange={(e) => setNewOptionLabel(e.target.value)}
                  placeholder="Ex: Especialista"
                  className={controlClass}
                />
              </div>
              {field.field_type === "competency_description" && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    Descrição
                  </label>
                  <textarea
                    value={newOptionDescription}
                    onChange={(e) => setNewOptionDescription(e.target.value)}
                    rows={3}
                    placeholder="Descrição da competência"
                    className={controlClass}
                  />
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-md border border-border px-3 py-2 text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAddOption}
                disabled={savingOption || !newOptionLabel.trim()}
                className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50"
              >
                {savingOption ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  };

  // Fontes dinâmicas: Áreas / Setores
  if (field.data_source === "areas") {
    const opts = (areas ?? []).filter((a) => !a.parent_id);
    const selectedValue = resolveProjectAreaValue(value, opts);
    return (
      <select {...common} value={selectedValue} onChange={(e) => onChange(e.target.value)}>
        <option value="">— Selecione —</option>
        {opts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.nome}
          </option>
        ))}
      </select>
    );
  }
  if (field.data_source === "setores") {
    const allSetores = (areas ?? []).filter((a) => a.parent_id);
    const opts = parentAreaId ? allSetores.filter((a) => a.parent_id === parentAreaId) : [];
    const selectedValue = resolveProjectAreaValue(value, opts);
    return (
      <select
        {...common}
        value={selectedValue}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || !parentAreaId}
      >
        <option value="">{parentAreaId ? "— Selecione —" : "Selecione a Área primeiro"}</option>
        {opts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.nome}
          </option>
        ))}
      </select>
    );
  }

  if (field.field_type === "textarea")
    return (
      <textarea
        {...common}
        rows={4}
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  if (field.field_type === "number")
    return (
      <input
        {...common}
        type="number"
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
      />
    );
  if (field.field_type === "date")
    return (
      <input
        {...common}
        type="date"
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  if (field.field_type === "checkbox")
    return (
      <input
        type="checkbox"
        checked={Boolean(value)}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="h-5 w-5 accent-primary"
      />
    );
  if (field.field_type === "multi_select") {
    const selected = Array.isArray(value) ? value : [];
    return (
      <div className="space-y-2 rounded-md border border-border bg-background/60 p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Opções</span>
          {renderOptionAdder()}
        </div>
        {localOptions.map((option) => (
          <label key={option.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={selected.includes(option.value)}
              onChange={(e) =>
                onChange(
                  e.target.checked
                    ? [...selected, option.value]
                    : selected.filter((item) => item !== option.value),
                )
              }
              disabled={disabled}
              className="h-4 w-4 rounded"
            />
            {option.label}
          </label>
        ))}
      </div>
    );
  }
  if (field.field_type === "competency_description") {
    const selected = localOptions.find((o) => o.value === value);
    return (
      <div className="grid gap-2 grid-cols-1 md:grid-cols-[1fr_2.5fr]">
        <div className="flex items-center gap-2">
          <select
            {...common}
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
            className={`${controlClass} flex-1`}
          >
            <option value="">— Selecione —</option>
            {localOptions.map((option) => (
              <option key={option.id} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {renderOptionAdder()}
        </div>
        <div
          className={`${controlClass} min-h-[4rem] rounded-lg bg-muted/20 text-muted-foreground`}
        >
          <div className="flex h-full items-center p-3 text-sm leading-6">
            {selected?.description || (
              <span className="opacity-60">Descrição aparecerá ao selecionar a competência</span>
            )}
          </div>
        </div>
      </div>
    );
  }
  if (field.field_type === "single_select") {
    return (
      <div className="flex items-center gap-2">
        <select
          {...common}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          className={`${controlClass} flex-1`}
        >
          <option value="">— Selecione —</option>
          {localOptions.map((option) => (
            <option key={option.id} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {renderOptionAdder()}
      </div>
    );
  }
  return (
    <input {...common} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />
  );
}
