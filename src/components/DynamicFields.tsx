import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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
  field_type: "text" | "textarea" | "number" | "date" | "checkbox" | "single_select" | "multi_select" | "competency_description";
  is_required: boolean;
  allows_free_text: boolean;
  data_source: DataSource;
  options: Array<{ id: string; label: string; value: string; description: string | null }>;
};

const controlClass = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-ring";

export function useProjectFields(projectId: string) {
  const [fields, setFields] = useState<DynamicField[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    supabase
      .from("base_fields")
      .select("id,field_key,label,section,field_type,is_required,allows_free_text,data_source,display_order,base_options(id,label,value,description,is_active,display_order)")
      .eq("project_id", projectId)
      .eq("is_active", true)
      .order("display_order")
      .then(({ data }) => {
        setFields((data ?? []).map((field) => ({
          ...field,
          data_source: (field.data_source ?? "manual") as DataSource,
          options: (field.base_options ?? [])
            .filter((option) => option.is_active)
            .sort((a, b) => a.display_order - b.display_order)
            .map(({ id, label, value, description }) => ({ id, label, value, description: description ?? null })),
        })) as DynamicField[]);
        setLoading(false);
      });
  }, [projectId]);

  return { fields, loading };
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
      .then(({ data }) => setAreas((data ?? []) as ProjectArea[]));
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
  const common = { required: field.is_required, className: controlClass, disabled };

  // Fontes dinâmicas: Áreas / Setores
  if (field.data_source === "areas") {
    const opts = (areas ?? []).filter((a) => !a.parent_id);
    return (
      <select {...common} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}>
        <option value="">— Selecione —</option>
        {opts.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
      </select>
    );
  }
  if (field.data_source === "setores") {
    const opts = (areas ?? []).filter((a) => a.parent_id && (!parentAreaId || a.parent_id === parentAreaId));
    return (
      <select {...common} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} disabled={disabled || !parentAreaId}>
        <option value="">{parentAreaId ? "— Selecione —" : "Selecione a Área primeiro"}</option>
        {opts.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
      </select>
    );
  }

  if (field.field_type === "textarea") return <textarea {...common} rows={4} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />;
  if (field.field_type === "number") return <input {...common} type="number" value={String(value ?? "")} onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))} />;
  if (field.field_type === "date") return <input {...common} type="date" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />;
  if (field.field_type === "checkbox") return <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} disabled={disabled} className="h-5 w-5 accent-primary" />;
  if (field.field_type === "multi_select") {
    const selected = Array.isArray(value) ? value : [];
    return (
      <div className="space-y-2 rounded-md border border-border bg-background/60 p-3">
        {field.options.map((option) => (
          <label key={option.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={selected.includes(option.value)} onChange={(e) => onChange(e.target.checked ? [...selected, option.value] : selected.filter((item) => item !== option.value))} disabled={disabled} className="h-4 w-4 rounded" />
            {option.label}
          </label>
        ))}
      </div>
    );
  }
  if (field.field_type === "competency_description") {
    const selected = field.options.find((o) => o.value === value);
    return (
      <div className="grid gap-2 grid-cols-1 md:grid-cols-[1fr_2.5fr]">
        <select {...common} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}>
          <option value="">— Selecione —</option>
          {field.options.map((option) => <option key={option.id} value={option.value}>{option.label}</option>)}
        </select>
        <div className={`${controlClass} min-h-[4rem] rounded-lg bg-muted/20 text-muted-foreground`}>
          <div className="flex h-full items-center p-3 text-sm leading-6">
            {selected?.description || <span className="opacity-60">Descrição aparecerá ao selecionar a competência</span>}
          </div>
        </div>
      </div>
    );
  }
  if (field.field_type === "single_select") {
    return (
      <select {...common} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}>
        <option value="">— Selecione —</option>
        {field.options.map((option) => <option key={option.id} value={option.value}>{option.label}</option>)}
      </select>
    );
  }
  return <input {...common} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />;
}