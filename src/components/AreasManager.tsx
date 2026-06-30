import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Area = {
  id: string;
  project_id: string;
  parent_id: string | null;
  nome: string;
  cor: string | null;
  display_order: number;
};

const DEFAULT_COLORS = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
  "#EC4899", "#06B6D4", "#F97316", "#84CC16", "#6366F1",
];

const pickColor = (i: number) => DEFAULT_COLORS[i % DEFAULT_COLORS.length];

const inp = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

export function AreasManager({ projectId }: { projectId: string }) {
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [newAreaName, setNewAreaName] = useState("");
  const [newSetorName, setNewSetorName] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("project_areas")
      .select("*")
      .eq("project_id", projectId)
      .order("display_order")
      .order("created_at");
    if (error) toast.error(error.message);
    setAreas((data ?? []) as Area[]);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  const topLevel = areas.filter((a) => !a.parent_id);
  const childrenOf = (id: string) => areas.filter((a) => a.parent_id === id);

  const addArea = async () => {
    const nome = newAreaName.trim();
    if (!nome) return;
    const cor = pickColor(topLevel.length);
    const { error } = await supabase
      .from("project_areas")
      .insert({ project_id: projectId, nome, cor, display_order: topLevel.length * 10 + 10 });
    if (error) return toast.error(error.message);
    setNewAreaName("");
    void load();
  };

  const addSetor = async (areaId: string) => {
    const nome = (newSetorName[areaId] ?? "").trim();
    if (!nome) return;
    const siblings = childrenOf(areaId);
    const parentArea = areas.find((a) => a.id === areaId);
    const { error } = await supabase
      .from("project_areas")
      .insert({
        project_id: projectId,
        parent_id: areaId,
        nome,
        cor: parentArea?.cor ?? null,
        display_order: siblings.length * 10 + 10,
      });
    if (error) return toast.error(error.message);
    setNewSetorName((p) => ({ ...p, [areaId]: "" }));
    setExpanded((p) => ({ ...p, [areaId]: true }));
    void load();
  };

  const remove = async (a: Area) => {
    const isArea = !a.parent_id;
    const msg = isArea
      ? `Excluir a área "${a.nome}" e todos seus setores?`
      : `Excluir o setor "${a.nome}"?`;
    if (!confirm(msg)) return;
    const { error } = await supabase.from("project_areas").delete().eq("id", a.id);
    if (error) return toast.error(error.message);
    void load();
  };

  const startEdit = (a: Area) => { setEditing(a.id); setEditValue(a.nome); };
  const saveEdit = async (a: Area) => {
    const novo = editValue.trim();
    if (!novo || novo === a.nome) { setEditing(null); return; }
    const { error } = await supabase.from("project_areas").update({ nome: novo }).eq("id", a.id);
    if (error) return toast.error(error.message);
    setEditing(null);
    void load();
  };

  const toggle = (id: string) => setExpanded((p) => ({ ...p, [id]: !p[id] }));

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">Estrutura organizacional</p>
      <h1 className="mt-2 font-display text-4xl">Áreas</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Cadastre as Áreas e, dentro de cada uma, os Setores. Esses valores alimentam automaticamente
        os campos "Área" e "Setor" das descrições de cargo. Apenas o admin ou o responsável pelo projeto pode editar.
      </p>

      <div className="mt-8 flex gap-2">
        <input
          value={newAreaName}
          onChange={(e) => setNewAreaName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addArea())}
          placeholder="Nova área..."
          className={inp}
        />
        <button onClick={addArea} className="inline-flex shrink-0 items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
          <Plus className="h-4 w-4" /> Nova Área
        </button>
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-muted-foreground">Carregando...</p>
      ) : topLevel.length === 0 ? (
        <p className="mt-6 rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Nenhuma área cadastrada ainda.
        </p>
      ) : (
        <div className="mt-6 space-y-3">
          {topLevel.map((area) => {
            const setores = childrenOf(area.id);
            const isOpen = expanded[area.id] ?? true;
            return (
              <div key={area.id} className="rounded-xl border border-border bg-card">
                <div className="flex items-center gap-2 p-4">
                  <button onClick={() => toggle(area.id)} className="text-muted-foreground hover:text-foreground">
                    {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: area.cor ?? "#888" }} />
                  {editing === area.id ? (
                    <>
                      <input value={editValue} onChange={(e) => setEditValue(e.target.value)} className={inp} autoFocus
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveEdit(area); } if (e.key === "Escape") setEditing(null); }}
                      />
                      <button onClick={() => saveEdit(area)} className="rounded-md p-2 hover:bg-secondary"><Check className="h-4 w-4" /></button>
                      <button onClick={() => setEditing(null)} className="rounded-md p-2 hover:bg-secondary"><X className="h-4 w-4" /></button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 font-medium">{area.nome}</span>
                      <span className="text-xs text-muted-foreground">{setores.length} setor(es)</span>
                      <button onClick={() => startEdit(area)} className="rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => remove(area)} className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                    </>
                  )}
                </div>

                {isOpen && (
                  <div className="border-t border-border bg-background/30 p-4">
                    {setores.length > 0 && (
                      <div className="mb-3 space-y-2">
                        {setores.map((s) => (
                          <div key={s.id} className="flex items-center gap-2 rounded-md border border-border bg-card p-2 pl-3">
                            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.cor ?? area.cor ?? "#888" }} />
                            {editing === s.id ? (
                              <>
                                <input value={editValue} onChange={(e) => setEditValue(e.target.value)} className={inp} autoFocus
                                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveEdit(s); } if (e.key === "Escape") setEditing(null); }}
                                />
                                <button onClick={() => saveEdit(s)} className="rounded-md p-1.5 hover:bg-secondary"><Check className="h-3.5 w-3.5" /></button>
                                <button onClick={() => setEditing(null)} className="rounded-md p-1.5 hover:bg-secondary"><X className="h-3.5 w-3.5" /></button>
                              </>
                            ) : (
                              <>
                                <span className="flex-1 text-sm">{s.nome}</span>
                                <button onClick={() => startEdit(s)} className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                                <button onClick={() => remove(s)} className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <input
                        value={newSetorName[area.id] ?? ""}
                        onChange={(e) => setNewSetorName((p) => ({ ...p, [area.id]: e.target.value }))}
                        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSetor(area.id))}
                        placeholder="Novo setor..."
                        className={inp}
                      />
                      <button onClick={() => addSetor(area.id)} className="inline-flex shrink-0 items-center gap-1 rounded-md bg-secondary px-3 py-2 text-sm hover:bg-secondary/80">
                        <Plus className="h-3.5 w-3.5" /> Adicionar setor
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
