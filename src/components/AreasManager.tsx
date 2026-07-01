import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Plus, Trash2, Pencil, Check, X, Layers, Building2, FolderTree } from "lucide-react";
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
  "#042558", "#1a5a8a", "#2d7ab5", "#4a9ad9", "#6bb5e8",
  "#8ccaf0", "#aedbf5", "#cfe8fa", "#e5f2fc", "#f0f8ff",
];

const pickColor = (i: number) => DEFAULT_COLORS[i % DEFAULT_COLORS.length];

const inp = "w-full rounded-lg border border-[#042558]/20 bg-white/50 px-3 py-2 text-sm text-[#042558] outline-none transition-all focus:border-[#042558] focus:ring-2 focus:ring-[#042558]/20 placeholder:text-[#042558]/40";

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
    <main className="min-h-screen bg-gradient-to-br from-[#042558]/5 via-white to-[#042558]/5 px-6 py-8">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-8 rounded-2xl border border-[#042558]/10 bg-white/80 p-6 shadow-sm backdrop-blur-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-[#042558]">Áreas e Setores</h1>
                </div>
              </div>
              <p className="mt-3 max-w-2xl text-sm text-[#042558]/50">
                Cadastre as Áreas e, dentro de cada uma, os Setores. Esses valores alimentam automaticamente
                os campos "Área" e "Setor" das descrições de cargo.
              </p>
            </div>
          </div>
        </div>

        {/* Add Area */}
        <div className="mb-8 rounded-2xl border border-[#042558]/10 bg-white/60 p-4 shadow-sm backdrop-blur-sm">
          <div className="flex gap-3">
            <input
              value={newAreaName}
              onChange={(e) => setNewAreaName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addArea())}
              placeholder="Nova área..."
              className={inp}
            />
            <button 
              onClick={addArea} 
              className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[#042558] px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-[#042558]/20 transition-all hover:bg-[#042558]/90 hover:shadow-xl hover:shadow-[#042558]/30"
            >
              <Plus className="h-4 w-4" /> Nova Área
            </button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex h-64 items-center justify-center rounded-2xl border border-[#042558]/10 bg-white/60">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#042558] border-t-transparent" />
              <p className="text-sm text-[#042558]/60">Carregando áreas...</p>
            </div>
          </div>
        ) : topLevel.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#042558]/20 bg-white/60 p-12">
            <Building2 className="mb-4 h-12 w-12 text-[#042558]/20" />
            <p className="text-sm font-medium text-[#042558]/60">Nenhuma área cadastrada</p>
            <p className="text-xs text-[#042558]/40">Comece criando sua primeira área acima</p>
          </div>
        ) : (
          <div className="space-y-4">
            {topLevel.map((area) => {
              const setores = childrenOf(area.id);
              const isOpen = expanded[area.id] ?? true;
              return (
                <div key={area.id} className="overflow-hidden rounded-2xl border border-[#042558]/10 bg-white/60 shadow-sm transition-all hover:shadow-md">
                  {/* Area Header */}
                  <div className="flex items-center gap-3 bg-[#042558]/5 p-4 transition-colors hover:bg-[#042558]/10">
                    <button 
                      onClick={() => toggle(area.id)} 
                      className="rounded-md p-1 text-[#042558]/40 transition-colors hover:bg-[#042558]/10 hover:text-[#042558]"
                    >
                      {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                    <div 
                      className="h-4 w-4 shrink-0 rounded-full shadow-sm" 
                      style={{ background: area.cor ?? "#042558" }}
                    />
                    {editing === area.id ? (
                      <div className="flex flex-1 items-center gap-2">
                        <input 
                          value={editValue} 
                          onChange={(e) => setEditValue(e.target.value)} 
                          className={`${inp} flex-1`} 
                          autoFocus
                          onKeyDown={(e) => { 
                            if (e.key === "Enter") { e.preventDefault(); saveEdit(area); } 
                            if (e.key === "Escape") setEditing(null); 
                          }}
                        />
                        <button 
                          onClick={() => saveEdit(area)} 
                          className="rounded-lg bg-[#042558] p-2 text-white transition-colors hover:bg-[#042558]/90"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => setEditing(null)} 
                          className="rounded-lg border border-[#042558]/20 p-2 text-[#042558]/60 transition-colors hover:bg-[#042558]/10"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="flex-1 font-semibold text-[#042558]">{area.nome}</span>
                        <span className="rounded-full bg-[#042558]/10 px-2.5 py-0.5 text-xs font-medium text-[#042558]">
                          {setores.length} setor{setores.length !== 1 ? 'es' : ''}
                        </span>
                        <button 
                          onClick={() => startEdit(area)} 
                          className="rounded-md p-1.5 text-[#042558]/40 transition-colors hover:bg-[#042558]/10 hover:text-[#042558]"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => remove(area)} 
                          className="rounded-md p-1.5 text-[#042558]/40 transition-colors hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>

                  {/* Setores */}
                  {isOpen && (
                    <div className="border-t border-[#042558]/10 bg-white/30 p-4">
                      {setores.length > 0 && (
                        <div className="mb-4 space-y-2">
                          {setores.map((s) => (
                            <div 
                              key={s.id} 
                              className="flex items-center gap-3 rounded-xl border border-[#042558]/10 bg-white/60 p-3 transition-all hover:border-[#042558]/30 hover:shadow-sm"
                            >
                              <div 
                                className="h-2.5 w-2.5 shrink-0 rounded-full shadow-sm" 
                                style={{ background: s.cor ?? area.cor ?? "#042558" }}
                              />
                              {editing === s.id ? (
                                <div className="flex flex-1 items-center gap-2">
                                  <input 
                                    value={editValue} 
                                    onChange={(e) => setEditValue(e.target.value)} 
                                    className={`${inp} flex-1`} 
                                    autoFocus
                                    onKeyDown={(e) => { 
                                      if (e.key === "Enter") { e.preventDefault(); saveEdit(s); } 
                                      if (e.key === "Escape") setEditing(null); 
                                    }}
                                  />
                                  <button 
                                    onClick={() => saveEdit(s)} 
                                    className="rounded-lg bg-[#042558] p-1.5 text-white transition-colors hover:bg-[#042558]/90"
                                  >
                                    <Check className="h-3.5 w-3.5" />
                                  </button>
                                  <button 
                                    onClick={() => setEditing(null)} 
                                    className="rounded-lg border border-[#042558]/20 p-1.5 text-[#042558]/60 transition-colors hover:bg-[#042558]/10"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <span className="flex-1 text-sm font-medium text-[#042558]">{s.nome}</span>
                                  <button 
                                    onClick={() => startEdit(s)} 
                                    className="rounded-md p-1 text-[#042558]/40 transition-colors hover:bg-[#042558]/10 hover:text-[#042558]"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  <button 
                                    onClick={() => remove(s)} 
                                    className="rounded-md p-1 text-[#042558]/40 transition-colors hover:bg-red-50 hover:text-red-600"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* Add Setor */}
                      <div className="flex gap-2">
                        <input
                          value={newSetorName[area.id] ?? ""}
                          onChange={(e) => setNewSetorName((p) => ({ ...p, [area.id]: e.target.value }))}
                          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSetor(area.id))}
                          placeholder="Novo setor..."
                          className={`${inp} flex-1`}
                        />
                        <button 
                          onClick={() => addSetor(area.id)} 
                          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#042558]/20 bg-white/60 px-3 py-2 text-sm font-medium text-[#042558] transition-all hover:bg-[#042558] hover:text-white hover:shadow-lg hover:shadow-[#042558]/20"
                        >
                          <Plus className="h-3.5 w-3.5" /> Adicionar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}