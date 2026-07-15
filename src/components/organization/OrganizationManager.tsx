import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Network, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  availableParents,
  buildOrganizationTree,
  flattenTree,
  getAncestorIds,
  getChildren,
  getDescendantIds,
  type OrganizationPosition,
  type PositionStatus,
} from "@/lib/organization";
import { OrganizationToolbar } from "./OrganizationToolbar";
import { OrganizationChart } from "./OrganizationChart";
import { PositionFormModal } from "./PositionFormModal";
import { ChangeParentModal } from "./ChangeParentModal";
import { DeletePositionModal } from "./DeletePositionModal";
import { PositionDetailsPanel } from "./PositionDetailsPanel";

type FormState = {
  open: boolean;
  mode: "create" | "edit" | "insertAbove";
  position: OrganizationPosition | null;
  defaultParentId: string | null;
};

const initialFormState: FormState = { open: false, mode: "create", position: null, defaultParentId: null };

export function OrganizationManager({ projectId }: { projectId: string }) {
  const { user } = useCurrentUser();
  const [positions, setPositions] = useState<OrganizationPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<OrganizationPosition | null>(null);
  const [formState, setFormState] = useState<FormState>(initialFormState);
  const [moveTarget, setMoveTarget] = useState<OrganizationPosition | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OrganizationPosition | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const focusPendingRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("project_positions")
      .select("*")
      .eq("project_id", projectId)
      .order("display_order")
      .order("created_at");

    if (error) toast.error(error.message);
    setPositions((data ?? []) as OrganizationPosition[]);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  const tree = useMemo(() => buildOrganizationTree(positions), [positions]);
  const flatTree = useMemo(() => flattenTree(tree), [tree]);

  useEffect(() => {
    const term = query.trim().toLowerCase();
    if (!term) {
      setHighlightedId(null);
      return;
    }

    const found = positions.find((position) => position.nome.toLowerCase().includes(term));
    setHighlightedId(found?.id ?? null);
    if (found) {
      setCollapsed((current) => {
        const next = new Set(current);
        getAncestorIds(positions, found.id).forEach((id) => next.delete(id));
        return next;
      });
      focusPendingRef.current = found.id;
    }
  }, [positions, query]);

  useEffect(() => {
    if (!focusPendingRef.current) return;
    const id = focusPendingRef.current;
    const timeout = window.setTimeout(() => {
      document.querySelector(`[data-position-id="${id}"]`)?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
      focusPendingRef.current = null;
    }, 80);
    return () => window.clearTimeout(timeout);
  }, [collapsed, highlightedId, positions]);

  const openCreate = (parentId: string | null = null) => {
    setFormState({ open: true, mode: "create", position: null, defaultParentId: parentId });
  };

  const openSibling = (position: OrganizationPosition) => {
    setFormState({ open: true, mode: "create", position: null, defaultParentId: position.parent_id });
  };

  const openEdit = (position: OrganizationPosition) => {
    setFormState({ open: true, mode: "edit", position, defaultParentId: position.parent_id });
  };

  const openInsertAbove = (position: OrganizationPosition) => {
    setFormState({ open: true, mode: "insertAbove", position, defaultParentId: position.parent_id });
  };

  const savePosition = async (values: { nome: string; descricao: string | null; parent_id: string | null; display_order: number; status: PositionStatus }) => {
    if (!values.nome) {
      toast.error("Nome do cargo é obrigatório.");
      return;
    }

    if (formState.mode === "insertAbove" && formState.position) {
      const { error } = await (supabase as any).rpc("insert_project_position_above", {
        _target_id: formState.position.id,
        _nome: values.nome,
        _descricao: values.descricao,
        _status: values.status,
      });
      if (error) return toast.error(error.message);
      toast.success("Cargo inserido acima");
    } else if (formState.mode === "edit" && formState.position) {
      const { error } = await (supabase as any)
        .from("project_positions")
        .update({
          nome: values.nome,
          descricao: values.descricao,
          parent_id: values.parent_id,
          display_order: values.display_order,
          status: values.status,
        })
        .eq("id", formState.position.id)
        .eq("project_id", projectId);
      if (error) return toast.error(error.message);
      toast.success("Cargo atualizado");
    } else {
      const siblings = getChildren(positions, values.parent_id);
      const { error } = await (supabase as any).from("project_positions").insert({
        project_id: projectId,
        parent_id: values.parent_id,
        nome: values.nome,
        descricao: values.descricao,
        display_order: Number.isFinite(values.display_order) ? values.display_order : siblings.length * 10 + 10,
        status: values.status,
        created_by: user?.id ?? null,
      });
      if (error) return toast.error(error.message);
      toast.success("Cargo cadastrado");
    }

    setFormState(initialFormState);
    await load();
  };

  const movePosition = async (position: OrganizationPosition, parentId: string | null) => {
    if (parentId === position.id) {
      toast.error("Um cargo não pode ser superior dele mesmo.");
      return;
    }
    if (parentId && getDescendantIds(positions, position.id).has(parentId)) {
      toast.error("Não é permitido mover um cargo para baixo de um subordinado.");
      return;
    }
    if (parentId && !availableParents(positions, position).some((option) => option.id === parentId)) {
      toast.error("Superior imediato inválido.");
      return;
    }

    const { error } = await (supabase as any).rpc("move_project_position", {
      _position_id: position.id,
      _new_parent_id: parentId,
    });
    if (error) return toast.error(error.message);
    toast.success("Superior imediato alterado");
    setMoveTarget(null);
    await load();
  };

  const deletePosition = async (childrenParentId: string | null) => {
    if (!deleteTarget) return;
    const { error } = await (supabase as any).rpc("delete_project_position_with_reassignment", {
      _position_id: deleteTarget.id,
      _children_parent_id: childrenParentId,
    });
    if (error) return toast.error(error.message);
    toast.success("Cargo excluído");
    if (selected?.id === deleteTarget.id) setSelected(null);
    setDeleteTarget(null);
    await load();
  };

  const reorderPosition = async (position: OrganizationPosition, direction: "up" | "down") => {
    const { error } = await (supabase as any).rpc("reorder_project_position", {
      _position_id: position.id,
      _direction: direction,
    });
    if (error) return toast.error(error.message);
    await load();
  };

  const handleDropOn = async (sourceId: string, target: OrganizationPosition) => {
    const source = positions.find((position) => position.id === sourceId);
    if (!source || source.id === target.id) return;
    if (getDescendantIds(positions, source.id).has(target.id)) {
      toast.error("Não é permitido mover um cargo para baixo de um subordinado.");
      return;
    }
    if (!confirm(`Deseja mover o cargo ${source.nome} para baixo de ${target.nome}?`)) return;
    await movePosition(source, target.id);
  };

  const expandAll = () => setCollapsed(new Set());
  const collapseAll = () => setCollapsed(new Set(positions.filter((position) => getChildren(positions, position.id).length > 0).map((position) => position.id)));

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#042558]/5 via-white to-[#042558]/5 px-6 py-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="rounded-2xl border border-[#042558]/10 bg-white/80 p-6 shadow-sm backdrop-blur-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#042558]/45">Projeto</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#042558]">Organograma</h1>
              <p className="mt-2 max-w-2xl text-sm text-[#042558]/55">
                Cadastre cargos e organize relações de liderança. A posição visual é calculada automaticamente pela hierarquia.
              </p>
            </div>
            <button type="button" onClick={() => openCreate(null)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#042558] px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-[#042558]/20 hover:bg-[#042558]/90">
              <Plus className="h-4 w-4" />
              Novo cargo
            </button>
          </div>
        </div>

        <OrganizationToolbar
          query={query}
          zoom={zoom}
          onQueryChange={setQuery}
          onZoomIn={() => setZoom((value) => Math.min(1.6, Number((value + 0.1).toFixed(2))))}
          onZoomOut={() => setZoom((value) => Math.max(0.5, Number((value - 0.1).toFixed(2))))}
          onResetZoom={() => setZoom(1)}
          onFit={() => setZoom(0.75)}
          onExpandAll={expandAll}
          onCollapseAll={collapseAll}
        />

        {loading ? (
          <div className="flex h-80 items-center justify-center rounded-2xl border border-[#042558]/10 bg-white/60">
            <div className="flex items-center gap-3 text-sm text-[#042558]/60">
              <Loader2 className="h-5 w-5 animate-spin" />
              Carregando organograma...
            </div>
          </div>
        ) : positions.length === 0 ? (
          <div className="flex min-h-[420px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#042558]/20 bg-white/60 p-10 text-center">
            <Network className="mb-4 h-12 w-12 text-[#042558]/25" />
            <h2 className="text-lg font-semibold text-[#042558]">Este projeto ainda não possui um organograma.</h2>
            <button type="button" onClick={() => openCreate(null)} className="mt-5 rounded-lg bg-[#042558] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#042558]/90">
              Cadastrar primeiro cargo
            </button>
          </div>
        ) : (
          <OrganizationChart
            nodes={tree}
            positions={positions}
            zoom={zoom}
            collapsed={collapsed}
            selectedId={selected?.id ?? null}
            highlightedId={highlightedId}
            onSelect={setSelected}
            onToggle={(id) => setCollapsed((current) => {
              const next = new Set(current);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            })}
            onAddChild={(position) => openCreate(position.id)}
            onAddSibling={openSibling}
            onInsertAbove={openInsertAbove}
            onEdit={openEdit}
            onMove={setMoveTarget}
            onDelete={setDeleteTarget}
            onReorder={reorderPosition}
            onDropOn={handleDropOn}
          />
        )}

        <p className="text-xs text-[#042558]/45">
          {positions.length} cargo(s) cadastrado(s). {flatTree.length} cargo(s) visível(is) na hierarquia atual.
        </p>
      </div>

      <PositionDetailsPanel
        position={selected}
        positions={positions}
        onClose={() => setSelected(null)}
        onEdit={openEdit}
        onMove={setMoveTarget}
        onAddChild={(position) => openCreate(position.id)}
      />

      <PositionFormModal
        open={formState.open}
        mode={formState.mode}
        positions={positions}
        position={formState.position}
        defaultParentId={formState.defaultParentId}
        onClose={() => setFormState(initialFormState)}
        onSubmit={savePosition}
      />

      <ChangeParentModal
        open={Boolean(moveTarget)}
        positions={positions}
        position={moveTarget}
        onClose={() => setMoveTarget(null)}
        onSubmit={(parentId) => moveTarget && movePosition(moveTarget, parentId)}
      />

      <DeletePositionModal
        open={Boolean(deleteTarget)}
        positions={positions}
        position={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onSubmit={deletePosition}
      />
    </main>
  );
}
