import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { type DescricaoCargo, empty } from "@/lib/dc-types";

const inp =
  "w-full rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";
const lbl = "text-xs font-medium uppercase tracking-wider text-muted-foreground";

function Section({
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className={lbl}>{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function Repeater<T>({
  items, label, onAdd, onRemove, render,
}: {
  items: T[]; label: string;
  onAdd: () => void; onRemove: (i: number) => void;
  render: (item: T, i: number) => React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      {items.length === 0 && (
        <p className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
          Nenhum item adicionado
        </p>
      )}
      {items.map((it, i) => (
        <div key={i} className="relative rounded-lg border border-border bg-background/60 p-4">
          <button
            type="button"
            onClick={() => onRemove(i)}
            className="absolute right-2 top-2 rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <p className="mb-3 text-xs text-muted-foreground">#{i + 1}</p>
          {render(it, i)}
        </div>
      ))}
      <button
        type="button"
        onClick={onAdd}
        className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
      >
        <Plus className="h-4 w-4" /> Adicionar {label}
      </button>
    </div>
  );
}

export function DCForm({
  initial, onSubmit, submitLabel = "Salvar",
}: {
  initial: DescricaoCargo;
  onSubmit: (dc: DescricaoCargo) => Promise<void>;
  submitLabel?: string;
}) {
  const [dc, setDc] = useState<DescricaoCargo>(initial);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof DescricaoCargo>(k: K, v: DescricaoCargo[K]) =>
    setDc((p) => ({ ...p, [k]: v }));

  const updItem = <K extends keyof DescricaoCargo>(k: K, i: number, patch: any) => {
    setDc((p) => {
      const arr = [...(p[k] as any[])];
      arr[i] = { ...arr[i], ...patch };
      return { ...p, [k]: arr } as DescricaoCargo;
    });
  };
  const add = <K extends keyof DescricaoCargo>(k: K, factory: () => any) =>
    setDc((p) => ({ ...p, [k]: [...(p[k] as any[]), factory()] }) as DescricaoCargo);
  const del = <K extends keyof DescricaoCargo>(k: K, i: number) =>
    setDc((p) => ({ ...p, [k]: (p[k] as any[]).filter((_, j) => j !== i) }) as DescricaoCargo);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try { await onSubmit(dc); } finally { setSaving(false); }
  };

  return (
    <form onSubmit={handle} className="space-y-6">
      <Section num="01" title="Cabeçalho" desc="Identificação básica do cargo.">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Cargo *">
            <input required value={dc.cargo} onChange={(e) => set("cargo", e.target.value)} className={inp} />
          </Field>
          <Field label="Unidade de negócio">
            <input value={dc.unidade_negocio} onChange={(e) => set("unidade_negocio", e.target.value)} className={inp} />
          </Field>
          <Field label="Departamento">
            <input value={dc.departamento} onChange={(e) => set("departamento", e.target.value)} className={inp} />
          </Field>
          <Field label="Nivelamento">
            <input value={dc.nivelamento} onChange={(e) => set("nivelamento", e.target.value)} className={inp} placeholder="Júnior, Pleno, Sênior..." />
          </Field>
          <Field label="Superior imediato">
            <input value={dc.superior_imediato} onChange={(e) => set("superior_imediato", e.target.value)} className={inp} />
          </Field>
          <Field label="Tipo de carreira">
            <input value={dc.tipo_carreira} onChange={(e) => set("tipo_carreira", e.target.value)} className={inp} />
          </Field>
          <Field label="Data da versão">
            <input type="date" value={dc.data_versao} onChange={(e) => set("data_versao", e.target.value)} className={inp} />
          </Field>
          <Field label="Última revisão">
            <input type="date" value={dc.data_revisao} onChange={(e) => set("data_revisao", e.target.value)} className={inp} />
          </Field>
          <Field label="Status">
            <select value={dc.status} onChange={(e) => set("status", e.target.value)} className={inp}>
              <option value="rascunho">Rascunho</option>
              <option value="em_revisao">Em revisão</option>
              <option value="aprovado">Aprovado</option>
              <option value="arquivado">Arquivado</option>
            </select>
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Objetivo do cargo">
            <textarea rows={4} value={dc.objetivo} onChange={(e) => set("objetivo", e.target.value)} className={inp} />
          </Field>
        </div>
      </Section>

      <Section num="02" title="Instrução" desc="Formação acadêmica exigida.">
        <Repeater
          items={dc.instrucao} label="instrução"
          onAdd={() => add("instrucao", empty.instrucao)}
          onRemove={(i) => del("instrucao", i)}
          render={(it, i) => (
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Requisito"><input value={it.requisito} onChange={(e) => updItem("instrucao", i, { requisito: e.target.value })} className={inp} /></Field>
              <Field label="Nível"><input value={it.nivel} onChange={(e) => updItem("instrucao", i, { nivel: e.target.value })} className={inp} /></Field>
              <Field label="Área"><input value={it.area} onChange={(e) => updItem("instrucao", i, { area: e.target.value })} className={inp} /></Field>
            </div>
          )}
        />
      </Section>

      <Section num="03" title="Experiência" desc="Vivências profissionais necessárias.">
        <Repeater
          items={dc.experiencia} label="experiência"
          onAdd={() => add("experiencia", empty.experiencia)}
          onRemove={(i) => del("experiencia", i)}
          render={(it, i) => (
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Requisito"><input value={it.requisito} onChange={(e) => updItem("experiencia", i, { requisito: e.target.value })} className={inp} /></Field>
              <Field label="Tempo (anos)"><input value={it.tempo} onChange={(e) => updItem("experiencia", i, { tempo: e.target.value })} className={inp} /></Field>
              <Field label="Tipo"><input value={it.tipo} onChange={(e) => updItem("experiencia", i, { tipo: e.target.value })} className={inp} /></Field>
              <Field label="Área específica"><input value={it.area} onChange={(e) => updItem("experiencia", i, { area: e.target.value })} className={inp} /></Field>
            </div>
          )}
        />
      </Section>

      <Section num="04" title="Conhecimento" desc="Conhecimentos técnicos exigidos.">
        <Repeater
          items={dc.conhecimento} label="conhecimento"
          onAdd={() => add("conhecimento", empty.conhecimento)}
          onRemove={(i) => del("conhecimento", i)}
          render={(it, i) => (
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Requisito"><input value={it.requisito} onChange={(e) => updItem("conhecimento", i, { requisito: e.target.value })} className={inp} /></Field>
              <Field label="Conhecimento técnico"><input value={it.tecnico} onChange={(e) => updItem("conhecimento", i, { tecnico: e.target.value })} className={inp} /></Field>
              <Field label="Nível"><input value={it.nivel} onChange={(e) => updItem("conhecimento", i, { nivel: e.target.value })} className={inp} placeholder="Básico, Intermediário, Avançado" /></Field>
              <Field label="Descrição"><textarea rows={2} value={it.descricao} onChange={(e) => updItem("conhecimento", i, { descricao: e.target.value })} className={inp} /></Field>
            </div>
          )}
        />
      </Section>

      <Section num="05" title="Atividades" desc="Macroprocessos e rotinas do cargo.">
        <Repeater
          items={dc.atividades} label="atividade"
          onAdd={() => add("atividades", empty.atividade)}
          onRemove={(i) => del("atividades", i)}
          render={(it, i) => (
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Macroprocesso"><input value={it.macroprocesso} onChange={(e) => updItem("atividades", i, { macroprocesso: e.target.value })} className={inp} /></Field>
              <Field label="S/N"><select value={it.sn} onChange={(e) => updItem("atividades", i, { sn: e.target.value })} className={inp}><option value="">—</option><option value="S">Sim</option><option value="N">Não</option></select></Field>
              <Field label="Atividade"><textarea rows={2} value={it.atividade} onChange={(e) => updItem("atividades", i, { atividade: e.target.value })} className={inp} /></Field>
              <Field label="Periodicidade"><input value={it.periodicidade} onChange={(e) => updItem("atividades", i, { periodicidade: e.target.value })} className={inp} placeholder="Diária, semanal..." /></Field>
            </div>
          )}
        />
      </Section>

      <Section num="06" title="Indicadores" desc="KPIs e metas do cargo.">
        <Repeater
          items={dc.indicadores} label="indicador"
          onAdd={() => add("indicadores", empty.indicador)}
          onRemove={(i) => del("indicadores", i)}
          render={(it, i) => (
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Nome do indicador"><input value={it.nome} onChange={(e) => updItem("indicadores", i, { nome: e.target.value })} className={inp} /></Field>
              <Field label="Meta"><input value={it.meta} onChange={(e) => updItem("indicadores", i, { meta: e.target.value })} className={inp} /></Field>
            </div>
          )}
        />
      </Section>

      <Section num="07" title="Habilidades do cargo">
        <Repeater
          items={dc.habilidades_cargo} label="habilidade"
          onAdd={() => add("habilidades_cargo", empty.habilidade)}
          onRemove={(i) => del("habilidades_cargo", i)}
          render={(it, i) => (
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Habilidade"><input value={it.nome} onChange={(e) => updItem("habilidades_cargo", i, { nome: e.target.value })} className={inp} /></Field>
              <Field label="Descrição"><input value={it.descricao} onChange={(e) => updItem("habilidades_cargo", i, { descricao: e.target.value })} className={inp} /></Field>
            </div>
          )}
        />
      </Section>

      <Section num="08" title="Habilidades culturais">
        <Repeater
          items={dc.habilidades_culturais} label="habilidade cultural"
          onAdd={() => add("habilidades_culturais", empty.habilidade)}
          onRemove={(i) => del("habilidades_culturais", i)}
          render={(it, i) => (
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Habilidade"><input value={it.nome} onChange={(e) => updItem("habilidades_culturais", i, { nome: e.target.value })} className={inp} /></Field>
              <Field label="Descrição"><input value={it.descricao} onChange={(e) => updItem("habilidades_culturais", i, { descricao: e.target.value })} className={inp} /></Field>
            </div>
          )}
        />
      </Section>

      <Section num="09" title="Postura & comportamento">
        <Repeater
          items={dc.postura} label="postura"
          onAdd={() => add("postura", empty.postura)}
          onRemove={(i) => del("postura", i)}
          render={(it, i) => (
            <Field label="Postura esperada">
              <input value={it.nome} onChange={(e) => updItem("postura", i, { nome: e.target.value })} className={inp} />
            </Field>
          )}
        />
      </Section>

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
