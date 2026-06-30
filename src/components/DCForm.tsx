import { useState, useCallback, memo } from "react";
import { Plus, Trash2 } from "lucide-react";
import { type DescricaoCargo, type DynamicItem } from "@/lib/dc-types";
import { DC_SECTIONS } from "@/lib/dc-sections";
import { DynamicFieldControl, useProjectFields, useProjectAreas, type DynamicField, type ProjectArea } from "@/components/DynamicFields";

const lbl = "text-xs font-medium uppercase tracking-wider text-muted-foreground";

const HEADER_SCALAR_KEYS = [
  "cargo", "unidade_negocio", "departamento", "nivelamento", "superior_imediato",
  "tipo_carreira", "data_versao", "data_revisao", "status", "objetivo",
] as const;
type HeaderScalarKey = (typeof HEADER_SCALAR_KEYS)[number];
const isHeaderScalar = (key: string): key is HeaderScalarKey =>
  (HEADER_SCALAR_KEYS as readonly string[]).includes(key);

const SectionShell = memo(function SectionShell({
  num, title, desc, children,
}: { num: string; title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6 md:p-8">
      <header className="mb-6 flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-accent">{num}</p>
          <h2 className="mt-1 font-display text-3xl">{title}</h2>
          {desc && <p className="mt-1 text-sm text-muted-foreground">{desc}</p>}
        </div>
      </header>
      {children}
    </section>
  );
});

const FieldWrap = memo(function FieldWrap({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className={lbl}>{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
});

function EmptyConfig({ message }: { message: string }) {
  return (
    <p className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
      {message}
    </p>
  );
}

const SingleField = memo(function SingleField({
  field,
  value,
  onChange,
  areas,
  parentAreaId,
}: {
  field: DynamicField;
  value: DynamicItem[string] | undefined;
  onChange: (key: string, val: DynamicItem[string]) => void;
  areas: ProjectArea[];
  parentAreaId?: string | null;
}) {
  const handleChange = useCallback(
    (next: string | number | boolean | string[]) => onChange(field.field_key, next),
    [field.field_key, onChange]
  );
  return (
    <FieldWrap label={`${field.label}${field.is_required ? " *" : ""}`}>
      <DynamicFieldControl field={field} value={value} onChange={handleChange} areas={areas} parentAreaId={parentAreaId} />
    </FieldWrap>
  );
});

// resolve o uuid de Área dentro de um conjunto de valores (header ou item)
function findAreaValue(fields: DynamicField[], getter: (key: string) => DynamicItem[string] | undefined): string | null {
  const f = fields.find((x) => x.data_source === "areas");
  if (!f) return null;
  const v = getter(f.field_key);
  return typeof v === "string" && v ? v : null;
}

export function DCForm({
  projectId, initial, onSubmit, submitLabel = "Salvar",
}: {
  projectId: string;
  initial: DescricaoCargo;
  onSubmit: (dc: DescricaoCargo) => Promise<void>;
  submitLabel?: string;
}) {
  const [dc, setDc] = useState<DescricaoCargo>(initial);
  const [saving, setSaving] = useState(false);
  const { fields, loading: loadingFields } = useProjectFields(projectId);
  const areas = useProjectAreas(projectId);

  const setScalar = useCallback(<K extends keyof DescricaoCargo>(k: K, v: DescricaoCargo[K]) =>
    setDc((p) => ({ ...p, [k]: v })), []);

  const setDynamicHeader = useCallback((key: string, value: DynamicItem[string]) =>
    setDc((p) => ({ ...p, dynamic_values: { ...p.dynamic_values, [key]: value } })), []);

  const handleHeaderChange = useCallback((key: string, val: DynamicItem[string]) => {
    if (isHeaderScalar(key)) setScalar(key, String(val ?? ""));
    else setDynamicHeader(key, val);
    // Se mudou a Área, limpa o Setor para não ficar inconsistente
    const changed = fields.find((f) => f.field_key === key);
    if (changed?.data_source === "areas") {
      const setor = fields.find((f) => f.section === changed.section && f.data_source === "setores");
      if (setor) {
        if (isHeaderScalar(setor.field_key)) setScalar(setor.field_key, "");
        else setDynamicHeader(setor.field_key, "");
      }
    }
  }, [setScalar, setDynamicHeader, fields]);

  const updItem = useCallback((arrayKey: keyof DescricaoCargo, i: number, fieldKey: string, val: DynamicItem[string]) => {
    setDc((p) => {
      const arr = [...(p[arrayKey] as DynamicItem[])];
      const next = { ...arr[i], [fieldKey]: val };
      // Limpa setor se área mudou dentro do item
      const changed = fields.find((f) => f.field_key === fieldKey);
      if (changed?.data_source === "areas") {
        const setor = fields.find((f) => f.section === changed.section && f.data_source === "setores");
        if (setor) next[setor.field_key] = "";
      }
      arr[i] = next;
      return { ...p, [arrayKey]: arr } as DescricaoCargo;
    });
  }, [fields]);

  const addItem = useCallback((arrayKey: keyof DescricaoCargo) =>
    setDc((p) => ({ ...p, [arrayKey]: [...(p[arrayKey] as DynamicItem[]), {}] }) as DescricaoCargo), []);

  const delItem = useCallback((arrayKey: keyof DescricaoCargo, i: number) =>
    setDc((p) => ({ ...p, [arrayKey]: (p[arrayKey] as DynamicItem[]).filter((_, j) => j !== i) }) as DescricaoCargo), []);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try { await onSubmit(dc); } finally { setSaving(false); }
  };

  const headerGetter = useCallback((key: string): DynamicItem[string] | undefined => {
    if (isHeaderScalar(key)) return dc[key] as string;
    return dc.dynamic_values[key];
  }, [dc]);

  const renderHeader = (sectionFields: DynamicField[]) => {
    if (sectionFields.length === 0) {
      return <EmptyConfig message="Nenhum campo configurado neste bloco. Configure em Base do projeto." />;
    }
    const parentAreaId = findAreaValue(sectionFields, headerGetter);
    return (
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 auto-rows-min">
        {sectionFields.map((field) => {
          const value = headerGetter(field.field_key);
          const wideField = field.field_type === "textarea" || field.field_type === "competency_description";
          return (
            <div key={field.id} className={wideField ? "md:col-span-2" : ""}>
              <SingleField
                field={field}
                value={value}
                onChange={handleHeaderChange}
                areas={areas}
                parentAreaId={field.data_source === "setores" ? parentAreaId : undefined}
              />
            </div>
          );
        })}
      </div>
    );
  };

  const renderRepeater = (
    arrayKey: keyof DescricaoCargo,
    itemSingular: string,
    sectionFields: DynamicField[],
  ) => {
    const items = dc[arrayKey] as DynamicItem[];
    if (sectionFields.length === 0) {
      return <EmptyConfig message="Nenhum campo configurado neste bloco. Configure em Base do projeto." />;
    }
    return (
      <div className="space-y-4">
        {items.length === 0 && (
          <p className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            Nenhum item adicionado
          </p>
        )}
        {items.map((item, i) => {
          const itemParentArea = findAreaValue(sectionFields, (k) => item[k]);
          return (
            <div key={i} className="relative rounded-lg border border-border bg-background/60 p-4">
              <button
                type="button"
                onClick={() => delItem(arrayKey, i)}
                className="absolute right-2 top-2 rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                aria-label="Remover"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <p className="mb-3 text-xs text-muted-foreground">#{i + 1}</p>
              <div className="grid gap-3 grid-cols-1 md:grid-cols-2 auto-rows-min">
                {sectionFields.map((field) => {
                  const wideField = field.field_type === "textarea" || field.field_type === "competency_description";
                  return (
                    <div key={field.id} className={wideField ? "md:col-span-2" : ""}>
                      <SingleField
                        field={field}
                        value={item[field.field_key]}
                        onChange={(k, v) => updItem(arrayKey, i, k, v)}
                        areas={areas}
                        parentAreaId={field.data_source === "setores" ? itemParentArea : undefined}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        <button
          type="button"
          onClick={() => addItem(arrayKey)}
          className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <Plus className="h-4 w-4" /> Adicionar {itemSingular}
        </button>
      </div>
    );
  };

  return (
    <form onSubmit={handle} className="space-y-6">
      {loadingFields ? (
        <p className="text-sm text-muted-foreground">Carregando configuração da base...</p>
      ) : (
        DC_SECTIONS.map((section) => {
          const sectionFields = fields.filter((field) => field.section === section.key);
          return (
            <SectionShell key={section.key} num={section.num} title={section.label}>
              {section.repeater
                ? renderRepeater(section.arrayKey as keyof DescricaoCargo, section.itemSingular ?? "item", sectionFields)
                : renderHeader(sectionFields)}
            </SectionShell>
          );
        })
      )}

      <div className="sticky bottom-4 z-10 flex flex-col gap-3 rounded-2xl border border-border bg-card/95 p-4 shadow-lg backdrop-blur sm:flex-row sm:justify-end">
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-primary px-6 py-2.5 text-sm text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Salvando..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
