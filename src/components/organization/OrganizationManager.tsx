import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Network, Loader2 } from "lucide-react";
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
  defaultDisplayOrder: number | null;
};

const initialFormState: FormState = {
  open: false,
  mode: "create",
  position: null,
  defaultParentId: null,
  defaultDisplayOrder: null,
};
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 1.6;

function clampZoom(value: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(value.toFixed(2))));
}

export function OrganizationManager({ projectId }: { projectId: string }) {
  const { user } = useCurrentUser();
  const [positions, setPositions] = useState<OrganizationPosition[]>([]);
  const [positionsWithDescription, setPositionsWithDescription] = useState<Set<string>>(new Set());
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
    const [{ data, error }, { data: descriptions, error: descriptionsError }] = await Promise.all([
      supabase
        .from("project_positions")
        .select("*")
        .eq("project_id", projectId)
        .order("display_order")
        .order("created_at"),
      supabase
        .from("descricoes_cargo")
        .select("organization_position_id")
        .eq("project_id", projectId)
        .not("organization_position_id", "is", null),
    ]);

    if (error) toast.error(error.message);
    if (descriptionsError) toast.error(descriptionsError.message);
    setPositions((data ?? []) as OrganizationPosition[]);
    setPositionsWithDescription(
      new Set(
        (descriptions ?? [])
          .map(
            (description: { organization_position_id: string | null }) =>
              description.organization_position_id,
          )
          .filter((id): id is string => Boolean(id)),
      ),
    );
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

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
      document
        .querySelector(`[data-position-id="${id}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
      focusPendingRef.current = null;
    }, 80);
    return () => window.clearTimeout(timeout);
  }, [collapsed, highlightedId, positions]);

  const getAppendDisplayOrder = (parentId: string | null) => {
    const siblings = getChildren(positions, parentId);
    return siblings.length > 0
      ? Math.max(...siblings.map((sibling) => sibling.display_order)) + 10
      : 10;
  };

  const openCreate = (parentId: string | null = null, displayOrder: number | null = null) => {
    setFormState({
      open: true,
      mode: "create",
      position: null,
      defaultParentId: parentId,
      defaultDisplayOrder: displayOrder ?? getAppendDisplayOrder(parentId),
    });
  };

  const openSibling = (position: OrganizationPosition) => {
    setFormState({
      open: true,
      mode: "create",
      position: null,
      defaultParentId: position.parent_id,
      defaultDisplayOrder: getAppendDisplayOrder(position.parent_id),
    });
  };

  const openEdit = (position: OrganizationPosition) => {
    setFormState({
      open: true,
      mode: "edit",
      position,
      defaultParentId: position.parent_id,
      defaultDisplayOrder: position.display_order,
    });
  };

  const openInsertAbove = (position: OrganizationPosition) => {
    setFormState({
      open: true,
      mode: "insertAbove",
      position,
      defaultParentId: position.parent_id,
      defaultDisplayOrder: position.display_order,
    });
  };

  const savePosition = async (values: {
    nome: string;
    descricao: string | null;
    parent_id: string | null;
    display_order: number;
    status: PositionStatus;
  }) => {
    if (!values.nome) {
      toast.error("Nome do cargo é obrigatório.");
      return;
    }

    if (formState.mode === "insertAbove" && formState.position) {
      const { error } = await supabase.rpc("insert_project_position_above", {
        _target_id: formState.position.id,
        _nome: values.nome,
        _descricao: values.descricao,
        _status: values.status,
      });
      if (error) return toast.error(error.message);
      toast.success("Cargo inserido acima");
    } else if (formState.mode === "edit" && formState.position) {
      const { error } = await supabase
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
      const fallbackOrder =
        siblings.length > 0
          ? Math.max(...siblings.map((sibling) => sibling.display_order)) + 10
          : 10;
      const displayOrder = Number.isFinite(values.display_order)
        ? values.display_order
        : fallbackOrder;
      const positionsToShift = siblings.filter((sibling) => sibling.display_order >= displayOrder);

      if (positionsToShift.length > 0) {
        const updates = await Promise.all(
          positionsToShift.map((sibling) =>
            supabase
              .from("project_positions")
              .update({ display_order: sibling.display_order + 10 })
              .eq("id", sibling.id)
              .eq("project_id", projectId),
          ),
        );
        const shiftError = updates.find((result) => result.error)?.error;
        if (shiftError) return toast.error(shiftError.message);
      }

      const { error } = await supabase.from("project_positions").insert({
        project_id: projectId,
        parent_id: values.parent_id,
        nome: values.nome,
        descricao: values.descricao,
        display_order: displayOrder,
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
    if (
      parentId &&
      !availableParents(positions, position).some((option) => option.id === parentId)
    ) {
      toast.error("Superior imediato inválido.");
      return;
    }

    const { error } = await supabase.rpc("move_project_position", {
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
    const { error } = await supabase.rpc("delete_project_position_with_reassignment", {
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
    const { error } = await supabase.rpc("reorder_project_position", {
      _position_id: position.id,
      _direction: direction,
    });
    if (error) return toast.error(error.message);
    await load();
  };

  const reorderAsSibling = async (
    source: OrganizationPosition,
    target: OrganizationPosition,
    placement: "before" | "after",
  ) => {
    const nextParentId = target.parent_id;
    const siblings = getChildren(positions, nextParentId).filter(
      (position) => position.id !== source.id,
    );
    const targetIndex = siblings.findIndex((position) => position.id === target.id);
    if (targetIndex < 0) return;

    const next = [...siblings];
    next.splice(placement === "before" ? targetIndex : targetIndex + 1, 0, source);

    const updates = await Promise.all(
      next.map((position, index) =>
        supabase
          .from("project_positions")
          .update({ parent_id: nextParentId, display_order: (index + 1) * 10 })
          .eq("id", position.id)
          .eq("project_id", projectId),
      ),
    );
    const error = updates.find((result) => result.error)?.error;
    if (error) return toast.error(error.message);
    toast.success("Cargo reposicionado");
    await load();
  };

  const handleDropOn = async (
    sourceId: string,
    target: OrganizationPosition,
    placement: "before" | "inside" | "after",
  ) => {
    const source = positions.find((position) => position.id === sourceId);
    if (!source || source.id === target.id) return;
    const nextParentId = placement === "inside" ? target.id : target.parent_id;
    if (nextParentId && getDescendantIds(positions, source.id).has(nextParentId)) {
      toast.error("Não é permitido mover um cargo para baixo de um subordinado.");
      return;
    }
    if (placement === "inside") {
      if (!confirm(`Deseja mover o cargo ${source.nome} para baixo de ${target.nome}?`)) return;
      await movePosition(source, target.id);
      return;
    }

    if (
      !confirm(
        `Deseja mover o cargo ${source.nome} para ${placement === "before" ? "antes" : "depois"} de ${target.nome}?`,
      )
    )
      return;
    await reorderAsSibling(source, target, placement);
  };

  const expandAll = () => setCollapsed(new Set());
  const collapseAll = () =>
    setCollapsed(
      new Set(
        positions
          .filter((position) => getChildren(positions, position.id).length > 0)
          .map((position) => position.id),
      ),
    );

  return (
    <main className="h-[calc(100vh-3rem)] min-h-0 overflow-hidden bg-gradient-to-br from-[#042558]/5 via-white to-[#042558]/5 px-3 py-3 sm:px-4 sm:py-4">
      <div className="flex h-full min-w-0 flex-col gap-3">
        <div className="shrink-0 rounded-xl border border-[#042558]/10 bg-white/80 p-4 shadow-sm backdrop-blur-sm">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#042558]/45">
                Projeto
              </p>
              <h1 className="mt-0.5 text-xl font-bold tracking-tight text-[#042558]">
                Organograma
              </h1>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-[#042558]/55">
                Cadastre cargos e organize relações de liderança. A posição visual é calculada
                automaticamente pela hierarquia.
              </p>
            </div>
          </div>
        </div>

        <OrganizationToolbar
          query={query}
          zoom={zoom}
          onQueryChange={setQuery}
          onZoomIn={() => setZoom((value) => clampZoom(value + 0.1))}
          onZoomOut={() => setZoom((value) => clampZoom(value - 0.1))}
          onResetZoom={() => setZoom(1)}
          onFit={() => setZoom(0.75)}
          onExpandAll={expandAll}
          onCollapseAll={collapseAll}
        />

        {loading ? (
          <div className="flex min-h-0 flex-1 items-center justify-center rounded-xl border border-[#042558]/10 bg-white/60">
            <div className="flex items-center gap-3 text-sm text-[#042558]/60">
              <Loader2 className="h-5 w-5 animate-spin" />
              Carregando organograma...
            </div>
          </div>
        ) : positions.length === 0 ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#042558]/20 bg-white/60 p-6 text-center">
            <Network className="mb-4 h-12 w-12 text-[#042558]/25" />
            <h2 className="text-lg font-semibold text-[#042558]">
              Este projeto ainda não possui um organograma.
            </h2>
            <button
              type="button"
              onClick={() => openCreate(null)}
              className="mt-5 rounded-lg bg-[#042558] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#042558]/90"
            >
              Cadastrar primeiro cargo
            </button>
          </div>
        ) : (
          <OrganizationChart
            nodes={tree}
            positions={positions}
            positionsWithDescription={positionsWithDescription}
            zoom={zoom}
            onZoomChange={setZoom}
            collapsed={collapsed}
            selectedId={selected?.id ?? null}
            highlightedId={highlightedId}
            onSelect={setSelected}
            onToggle={(id) =>
              setCollapsed((current) => {
                const next = new Set(current);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              })
            }
            onAddChild={(position) => openCreate(position.id)}
            onAddAt={(parentId, displayOrder) => openCreate(parentId, displayOrder)}
            onAddSibling={openSibling}
            onInsertAbove={openInsertAbove}
            onEdit={openEdit}
            onMove={setMoveTarget}
            onDelete={setDeleteTarget}
            onReorder={reorderPosition}
            onDropOn={handleDropOn}
          />
        )}

        <p className="shrink-0 text-xs text-[#042558]/45">
          {positions.length} cargo(s) cadastrado(s). {flatTree.length} cargo(s) visível(is) na
          hierarquia atual.
        </p>
      </div>

      <PositionDetailsPanel
        projectId={projectId}
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
        defaultDisplayOrder={formState.defaultDisplayOrder}
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
