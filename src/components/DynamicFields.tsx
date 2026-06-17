import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type DynamicField = {
  id: string;
  field_key: string;
  label: string;
  section: string;
  field_type: "text" | "textarea" | "number" | "date" | "checkbox" | "single_select" | "multi_select";
  is_required: boolean;
  allows_free_text: boolean;
  options: Array<{ id: string; label: string; value: string }>;
};

const controlClass = "w-full rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

export function useProjectFields(projectId: string) {
  const [fields, setFields] = useState<DynamicField[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    supabase
      .from("base_fields")
      .select("id,field_key,label,section,field_type,is_required,allows_free_text,base_options(id,label,value,is_active,display_order)")
      .eq("project_id", projectId)
      .eq("is_active", true)
      .order("display_order")
      .then(({ data }) => {
        setFields((data ?? []).map((field) => ({
          ...field,
          options: (field.base_options ?? [])
            .filter((option) => option.is_active)
            .sort((a, b) => a.display_order - b.display_order)
            .map(({ id, label, value }) => ({ id, label, value })),
        })) as DynamicField[]);
        setLoading(false);
      });
  }, [projectId]);

  return { fields, loading };
}

export function DynamicFieldControl({ field, value, onChange }: {
  field: DynamicField;
  value: string | number | boolean | string[] | undefined;
  onChange: (value: string | number | boolean | string[]) => void;
}) {
  const common = { required: field.is_required, className: controlClass };
  if (field.field_type === "textarea") return <textarea {...common} rows={4} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />;
  if (field.field_type === "number") return <input {...common} type="number" value={String(value ?? "")} onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))} />;
  if (field.field_type === "date") return <input {...common} type="date" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />;
  if (field.field_type === "checkbox") return <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5 accent-primary" />;
  if (field.field_type === "multi_select") {
    const selected = Array.isArray(value) ? value : [];
    return (
      <div className="space-y-2 rounded-md border border-border p-3">
        {field.options.map((option) => (
          <label key={option.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={selected.includes(option.value)} onChange={(e) => onChange(e.target.checked ? [...selected, option.value] : selected.filter((item) => item !== option.value))} />
            {option.label}
          </label>
        ))}
        {field.allows_free_text && <input className={controlClass} placeholder="Outro valor" onBlur={(e) => e.target.value && onChange([...selected, e.target.value])} />}
      </div>
    );
  }
  if (field.field_type === "single_select") {
    return (
      <div className="space-y-2">
        <select  {...common} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}>
          <option value="">
            — Selecione —
          </option>
          {field.options.map((option) => <option key={option.id} value={option.value}>{option.label}</option>)}
        </select>
        {field.allows_free_text && <input className={controlClass} placeholder="Ou digite um valor" value={field.options.some((option) => option.value === value) ? "" : String(value ?? "")} onChange={(e) => onChange(e.target.value)} />}
      </div>
    );
  }
  return <input {...common} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />;
}