import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { type DescricaoCargo, type DynamicItem } from "@/lib/dc-types";
import { DC_SECTIONS } from "@/lib/dc-sections";
import { DynamicFieldControl, useProjectFields, type DynamicField } from "@/components/DynamicFields";

const lbl = "text-xs font-medium uppercase tracking-wider text-muted-foreground";

// Campos escalares já existentes no cabeçalho (colunas dedicadas)
const HEADER_SCALAR_KEYS = [
  "cargo", "unidade_negocio", "departamento", "nivelamento", "superior_imediato",
  "tipo_carreira", "data_versao", "data_revisao", "status", "objetivo",
] as const;
type HeaderScalarKey = (typeof HEADER_SCALAR_KEYS)[number];
const isHeaderScalar = (key: string): key is HeaderScalarKey =>
  (HEADER_SCALAR_KEYS as readonly string[]).includes(key);

function SectionShell({
  num, title, desc, children,
}: { num: string; title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6 md:p-8">
      <header className="mb-6 flex items-start justify-between gap-4 border-b border-border pb-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-accent">{num}</p>
          <h2 className="mt-1 font-display text-3xl">{title}</h2>
          {desc && <p className="mt-1 text-sm text-muted-foreground">{desc}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}

function FieldWrap({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className={lbl}>{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function EmptyConfig({ message }: { message: string }) {
  return (
    <p className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
      {message}
    </p>
  );
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

  const setScalar = <K extends keyof DescricaoCargo>(k: K, v: DescricaoCargo[K]) =>
    setDc((p) => ({ ...p, [k]: v }));

  const setDynamicHeader = (key: string, value: DynamicItem[string]) =>
    setDc((p) => ({ ...p, dynamic_values: { ...p.dynamic_values, [key]: value } }));

  const updItem = (arrayKey: keyof DescricaoCargo, i: number, patch: DynamicItem) => {
    setDc((p) => {
      const arr = [...(p[arrayKey] as DynamicItem[])];
      arr[i] = { ...arr[i], ...patch };
      return { ...p, [arrayKey]: arr } as DescricaoCargo;
    });
  };
  const addItem = (arrayKey: keyof DescricaoCargo) =>
    setDc((p) => ({ ...p, [arrayKey]: [...(p[arrayKey] as DynamicItem[]), {}] }) as DescricaoCargo);
  const delItem = (arrayKey: keyof DescricaoCargo, i: number) =>
    setDc((p) => ({ ...p, [arrayKey]: (p[arrayKey] as DynamicItem[]).filter((_, j) => j !== i) }) as DescricaoCargo);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try { await onSubmit(dc); } finally { setSaving(false); }
  };

  const renderHeader = (sectionFields: DynamicField[]) => {
    if (sectionFields.length === 0) {
      return <EmptyConfig message="Nenhum campo configurado neste bloco. Configure em Base do projeto." />;
    }
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {sectionFields.map((field) => {
          const value = isHeaderScalar(field.field_key)
            ? dc[field.field_key]
            : dc.dynamic_values[field.field_key];
          return (
            <FieldWrap key={field.id} label={`${field.label}${field.is_required ? " *" : ""}`}>
              <DynamicFieldControl
                field={field}
                value={value as DynamicItem[string] | undefined}
                onChange={(next) => {
                  if (isHeaderScalar(field.field_key)) setScalar(field.field_key, String(next ?? ""));
                  else setDynamicHeader(field.field_key, next);
                }}
              />
            </FieldWrap>
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
        {items.map((item, i) => (
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
            <div className="grid gap-3 md:grid-cols-2">
              {sectionFields.map((field) => (
                <FieldWrap key={field.id} label={`${field.label}${field.is_required ? " *" : ""}`}>
                  <DynamicFieldControl
                    field={field}
                    value={item[field.field_key]}
                    onChange={(next) => updItem(arrayKey, i, { [field.field_key]: next })}
                  />
                </FieldWrap>
              ))}
            </div>
          </div>
        ))}
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

      <div className="sticky bottom-4 z-10 flex justify-end gap-3 rounded-2xl border border-border bg-card/95 p-4 shadow-lg backdrop-blur">
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
