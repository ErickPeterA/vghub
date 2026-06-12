import { useEffect, useMemo, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type FieldType = "text" | "textarea" | "number" | "date" | "checkbox" | "single_select" | "multi_select";
type Option = { id: string; label: string; value: string; display_order: number; is_active: boolean };
type Field = { id: string; field_key: string; label: string; section: string; field_type: FieldType; is_required: boolean; display_order: number; allows_multiple: boolean; allows_free_text: boolean; is_active: boolean; base_options: Option[] };
const inputClass = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";
const types: Array<{ value: FieldType; label: string }> = [
  { value: "text", label: "Texto livre" }, { value: "textarea", label: "Texto longo" }, { value: "number", label: "Número" },
  { value: "date", label: "Data" }, { value: "checkbox", label: "Caixa de seleção" }, { value: "single_select", label: "Seleção única" }, { value: "multi_select", label: "Seleção múltipla" },
];

export function BaseManager({ projectId = null, title, description }: { projectId?: string | null; title: string; description: string }) {
  const [fields, setFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState(true);
  const [newLabel, setNewLabel] = useState("");

  const load = async () => {
    setLoading(true);
    let query = supabase.from("base_fields").select("*,base_options(*)").order("display_order");
    query = projectId ? query.eq("project_id", projectId) : query.is("project_id", null);
    const { data, error } = await query;
    if (error) toast.error(error.message);
    setFields((data ?? []) as Field[]);
    setLoading(false);
  };
  useEffect(() => { void load(); }, [projectId]);

  const sections = useMemo(() => Array.from(new Set(fields.map((field) => field.section))), [fields]);
  const patchLocal = (id: string, patch: Partial<Field>) => setFields((current) => current.map((field) => field.id === id ? { ...field, ...patch } : field));
  const save = async (field: Field) => {
    const { base_options: _options, ...payload } = field;
    const { error } = await supabase.from("base_fields").update(payload).eq("id", field.id);
    if (error) toast.error(error.message); else toast.success("Campo atualizado");
  };
  const addField = async () => {
    if (!newLabel.trim()) return;
    const fieldKey = `${newLabel.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}_${Date.now()}`;
    const { error } = await supabase.from("base_fields").insert({ project_id: projectId, field_key: fieldKey, label: newLabel.trim(), section: "Geral", display_order: fields.length * 10 + 10 });
    if (error) return toast.error(error.message);
    setNewLabel(""); toast.success("Campo criado"); void load();
  };
  const removeField = async (id: string) => {
    if (!confirm("Excluir este campo e todas as opções?")) return;
    const { error } = await supabase.from("base_fields").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Campo excluído"); void load(); }
  };
  const addOption = async (field: Field) => {
    const label = prompt("Nome da nova opção");
    if (!label?.trim()) return;
    const value = `${label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_")}_${Date.now()}`;
    const { error } = await supabase.from("base_options").insert({ field_id: field.id, label: label.trim(), value, display_order: field.base_options.length * 10 + 10 });
    if (error) toast.error(error.message); else void load();
  };
  const toggleOption = async (option: Option) => {
    await supabase.from("base_options").update({ is_active: !option.is_active }).eq("id", option.id); void load();
  };
  const removeOption = async (id: string) => { await supabase.from("base_options").delete().eq("id", id); void load(); };

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">Bases dinâmicas</p>
      <h1 className="mt-2 font-display text-4xl">{title}</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{description}</p>
      <div className="my-8 flex gap-2 rounded-xl border border-border bg-card p-4">
        <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} className={inputClass} placeholder="Nome do novo campo" />
        <button onClick={addField} className="inline-flex shrink-0 items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"><Plus className="h-4 w-4" /> Criar campo</button>
      </div>
      {loading ? <p className="text-sm text-muted-foreground">Carregando base...</p> : fields.length === 0 ? <p className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">Nenhum campo configurado.</p> : (
        <div className="space-y-8">
          {sections.map((section) => <section key={section}>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{section}</h2>
            <div className="space-y-3">{fields.filter((field) => field.section === section).map((field) => (
              <div key={field.id} className="rounded-xl border border-border bg-card p-5">
                <div className="grid gap-3 md:grid-cols-[1.2fr_1fr_1fr_90px_auto]">
                  <input value={field.label} onChange={(e) => patchLocal(field.id, { label: e.target.value })} className={inputClass} aria-label="Nome do campo" />
                  <input value={field.section} onChange={(e) => patchLocal(field.id, { section: e.target.value })} className={inputClass} aria-label="Seção" />
                  <select value={field.field_type} onChange={(e) => patchLocal(field.id, { field_type: e.target.value as FieldType, allows_multiple: e.target.value === "multi_select" })} className={inputClass}>{types.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select>
                  <input type="number" value={field.display_order} onChange={(e) => patchLocal(field.id, { display_order: Number(e.target.value) })} className={inputClass} aria-label="Ordem" />
                  <div className="flex gap-1"><button onClick={() => save(field)} className="rounded-md border border-border p-2" title="Salvar"><Save className="h-4 w-4" /></button><button onClick={() => removeField(field.id)} className="rounded-md border border-border p-2 text-destructive" title="Excluir"><Trash2 className="h-4 w-4" /></button></div>
                </div>
                <div className="mt-3 flex flex-wrap gap-5 text-sm">
                  <label><input type="checkbox" checked={field.is_required} onChange={(e) => patchLocal(field.id, { is_required: e.target.checked })} /> Obrigatório</label>
                  <label><input type="checkbox" checked={field.is_active} onChange={(e) => patchLocal(field.id, { is_active: e.target.checked })} /> Ativo</label>
                  <label><input type="checkbox" checked={field.allows_free_text} onChange={(e) => patchLocal(field.id, { allows_free_text: e.target.checked })} /> Permitir digitação livre</label>
                </div>
                {(field.field_type === "single_select" || field.field_type === "multi_select") && <div className="mt-4 border-t border-border pt-4"><div className="mb-2 flex items-center justify-between"><span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Opções</span><button onClick={() => addOption(field)} className="text-sm text-primary">+ Adicionar opção</button></div><div className="flex flex-wrap gap-2">{field.base_options.sort((a,b) => a.display_order-b.display_order).map((option) => <span key={option.id} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${option.is_active ? "border-border" : "border-dashed opacity-50"}`}><button onClick={() => toggleOption(option)}>{option.label}</button><button onClick={() => removeOption(option.id)} aria-label="Excluir opção">×</button></span>)}</div></div>}
              </div>
            ))}</div>
          </section>)}
        </div>
      )}
    </main>
  );
}