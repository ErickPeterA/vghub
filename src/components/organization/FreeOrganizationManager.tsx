import { useCallback, useEffect, useMemo, useState } from "react";
import { GitBranch, Loader2, Network, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { apiJson } from "@/lib/api";
import {
  availableParents,
  getDescendantIds,
  type ConnectionHandle,
  type OrganizationPosition,
  type PositionStatus,
} from "@/lib/organization";
import { ChangeParentModal } from "./ChangeParentModal";
import { DeletePositionModal } from "./DeletePositionModal";
import { OrganizationChart } from "./OrganizationChart";
import { PositionDetailsPanel } from "./PositionDetailsPanel";
import { PositionFormModal } from "./PositionFormModal";

type FormState = {
  open: boolean;
  position: OrganizationPosition | null;
  parentId: string | null;
  x: number | null;
  y: number | null;
};

const closedForm: FormState = {
  open: false,
  position: null,
  parentId: null,
  x: null,
  y: null,
};

type PositionValues = {
  nome: string;
  descricao: string | null;
  parent_id: string | null;
  display_order: number;
  visual_level: number;
  layout_x: number | null;
  layout_y: number | null;
  status: PositionStatus;
};

export function FreeOrganizationManager({ projectId }: { projectId: string }) {
  const [positions, setPositions] = useState<OrganizationPosition[]>([]);
  const [positionsWithDescription, setPositionsWithDescription] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<OrganizationPosition | null>(null);
  const [form, setForm] = useState<FormState>(closedForm);
  const [moveTarget, setMoveTarget] = useState<OrganizationPosition | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OrganizationPosition | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiJson<{
        positions: OrganizationPosition[];
        positionsWithDescription: string[];
      }>(`/api/projects/${projectId}/organization`);
      setPositions(data.positions);
      setPositionsWithDescription(new Set(data.positionsWithDescription));
      setSelected((current) =>
        current ? (data.positions.find((position) => position.id === current.id) ?? null) : null,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao carregar organograma.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const highlightedId = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("pt-BR");
    if (!term) return null;
    return (
      positions.find((position) => position.nome.toLocaleLowerCase("pt-BR").includes(term))?.id ??
      null
    );
  }, [positions, query]);

  const nextOrder = useMemo(
    () =>
      positions.length > 0
        ? Math.max(...positions.map((position) => position.display_order)) + 10
        : 10,
    [positions],
  );

  const openCreateAt = useCallback((x: number, y: number) => {
    setForm({ open: true, position: null, parentId: null, x, y });
  }, []);

  const openCreate = useCallback(
    (parent: OrganizationPosition | null = null) => {
      const directChildren = parent
        ? positions.filter((position) => position.parent_id === parent.id).length
        : positions.filter((position) => !position.parent_id).length;
      setForm({
        open: true,
        position: null,
        parentId: parent?.id ?? null,
        x: parent ? (parent.layout_x ?? 80) + 360 : 80 + directChildren * 48,
        y: parent ? (parent.layout_y ?? 80) + directChildren * 176 : 80 + directChildren * 176,
      });
    },
    [positions],
  );

  const openEdit = useCallback((position: OrganizationPosition) => {
    setForm({
      open: true,
      position,
      parentId: position.parent_id,
      x: position.layout_x,
      y: position.layout_y,
    });
  }, []);

  const savePosition = async (values: PositionValues) => {
    if (!values.nome.trim()) return toast.error("Nome do cargo é obrigatório.");
    try {
      if (form.position) {
        await apiJson(`/api/projects/${projectId}/organization`, {
          method: "POST",
          body: { action: "update", positionId: form.position.id, values },
        });
        toast.success("Cargo atualizado");
      } else {
        await apiJson(`/api/projects/${projectId}/organization`, {
          method: "POST",
          body: { action: "create", values: { ...values, display_order: nextOrder } },
        });
        toast.success(values.parent_id ? "Cargo Criado e Conectado" : "Cargo Isolado Criado");
      }
      setForm(closedForm);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar o cargo.");
    }
  };

  const movePositions = useCallback(
    async (updates: Array<{ id: string; x: number; y: number }>) => {
      setPositions((current) =>
        current.map((position) => {
          const update = updates.find((item) => item.id === position.id);
          return update ? { ...position, layout_x: update.x, layout_y: update.y } : position;
        }),
      );
      try {
        await apiJson(`/api/projects/${projectId}/organization`, {
          method: "POST",
          body: { action: "layout", updates },
        });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Erro ao salvar a posição.");
        await load();
      }
    },
    [load, projectId],
  );

  const connectPositions = useCallback(
    async (
      parentId: string,
      childId: string,
      sourceHandle: ConnectionHandle = "right",
      targetHandle: ConnectionHandle = "left",
    ) => {
      const parent = positions.find((position) => position.id === parentId);
      const child = positions.find((position) => position.id === childId);
      if (!parent || !child) return;
      if (getDescendantIds(positions, childId).has(parentId)) {
        toast.error("Essa conexão criaria um ciclo na hierarquia.");
        return;
      }
      if (child.parent_id === parentId) return;
      try {
        await apiJson(`/api/projects/${projectId}/organization`, {
          method: "POST",
          body: {
            action: "move",
            positionId: childId,
            parentId,
            sourceHandle,
            targetHandle,
          },
        });
        setPositions((current) =>
          current.map((position) =>
            position.id === childId
              ? {
                  ...position,
                  parent_id: parentId,
                  connection_source_handle: sourceHandle,
                  connection_target_handle: targetHandle,
                }
              : position,
          ),
        );
        toast.success(`${child.nome} conectado a ${parent.nome}`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Erro ao criar conexão.");
      }
    },
    [positions, projectId],
  );

  const disconnectPosition = useCallback(
    async (childId: string) => {
      const child = positions.find((position) => position.id === childId);
      if (!child?.parent_id) return;
      setPositions((current) =>
        current.map((position) =>
          position.id === childId ? { ...position, parent_id: null } : position,
        ),
      );
      try {
        await apiJson(`/api/projects/${projectId}/organization`, {
          method: "POST",
          body: { action: "move", positionId: childId, parentId: null },
        });
        toast.success("Conexão removida; o cargo continua no canvas");
      } catch (error) {
        setPositions((current) =>
          current.map((position) => (position.id === childId ? child : position)),
        );
        toast.error(error instanceof Error ? error.message : "Erro ao remover conexão.");
      }
    },
    [positions, projectId],
  );

  const changeParent = async (parentId: string | null) => {
    if (!moveTarget) return;
    if (parentId && !availableParents(positions, moveTarget).some((item) => item.id === parentId)) {
      return toast.error("Superior imediato inválido.");
    }
    if (parentId) await connectPositions(parentId, moveTarget.id);
    else await disconnectPosition(moveTarget.id);
    setMoveTarget(null);
  };

  const deletePosition = async (childrenParentId: string | null) => {
    if (!deleteTarget) return;
    try {
      await apiJson(`/api/projects/${projectId}/organization`, {
        method: "POST",
        body: { action: "delete", positionId: deleteTarget.id, childrenParentId },
      });
      if (selected?.id === deleteTarget.id) setSelected(null);
      setDeleteTarget(null);
      toast.success("Cargo excluído");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao excluir cargo.");
    }
  };

  return (
    <main className="h-[calc(100vh-3rem)] min-h-0 overflow-hidden bg-gradient-to-br from-[#042558]/5 via-white to-[#2f6fed]/5 px-3 py-3 sm:px-4 sm:py-4">
      <div className="flex h-full min-w-0 flex-col gap-3">
        <header className="flex shrink-0 flex-col gap-3 rounded-xl border border-[#042558]/10 bg-white/85 p-4 shadow-sm backdrop-blur lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#042558] text-white">
              <GitBranch className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-[#042558]">Organograma Livre</h1>
              <p className="text-xs text-[#042558]/55">
                Posicione os cargos livremente e conecte superior e subordinado pelas alças.
              </p>
            </div>
          </div>

          <div className="flex min-w-0 flex-1 items-center gap-2 lg:max-w-xl">
            <label className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#042558]/40" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Localizar cargo no canvas..."
                className="w-full rounded-lg border border-[#042558]/15 bg-white py-2 pl-9 pr-3 text-sm text-[#042558] outline-none focus:border-[#2f6fed] focus:ring-2 focus:ring-[#2f6fed]/15"
              />
            </label>
            <button
              type="button"
              onClick={() => openCreate(null)}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[#042558] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#042558]/90"
            >
              <Plus className="h-4 w-4" /> Cargo Isolado
            </button>
          </div>
        </header>

        {loading ? (
          <div className="flex min-h-0 flex-1 items-center justify-center rounded-xl border border-[#042558]/10 bg-white/60">
            <Loader2 className="mr-3 h-5 w-5 animate-spin text-[#042558]" />
            <span className="text-sm text-[#042558]/60">Carregando canvas...</span>
          </div>
        ) : positions.length === 0 ? (
          <button
            type="button"
            onClick={() => openCreate(null)}
            className="flex min-h-0 flex-1 flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#042558]/20 bg-white/60 p-6 text-center hover:bg-white/80"
          >
            <Network className="mb-4 h-12 w-12 text-[#042558]/25" />
            <strong className="text-lg text-[#042558]">Crie o Primeiro Cargo do Canvas</strong>
            <span className="mt-1 text-sm text-[#042558]/50">
              Depois você poderá arrastar e conectar tudo livremente.
            </span>
          </button>
        ) : (
          <OrganizationChart
            positions={positions}
            positionsWithDescription={positionsWithDescription}
            highlightedId={highlightedId}
            onSelect={setSelected}
            onEdit={openEdit}
            onAddChild={openCreate}
            onDelete={setDeleteTarget}
            onCreateAt={openCreateAt}
            onMovePositions={movePositions}
            onConnect={connectPositions}
            onDisconnect={disconnectPosition}
          />
        )}

        <p className="shrink-0 text-[11px] text-[#042558]/45">
          {positions.length} cargo(s) · arraste o fundo para navegar · use Shift para selecionar
          vários
        </p>
      </div>

      <PositionDetailsPanel
        projectId={projectId}
        position={selected}
        positions={positions}
        onClose={() => setSelected(null)}
        onEdit={openEdit}
        onMove={setMoveTarget}
        onAddChild={openCreate}
      />

      <PositionFormModal
        open={form.open}
        mode={form.position ? "edit" : "create"}
        positions={positions}
        position={form.position}
        defaultParentId={form.parentId}
        defaultDisplayOrder={nextOrder}
        defaultVisualLevel={1}
        defaultLayoutX={form.x}
        defaultLayoutY={form.y}
        onClose={() => setForm(closedForm)}
        onSubmit={savePosition}
      />

      <ChangeParentModal
        open={Boolean(moveTarget)}
        positions={positions}
        position={moveTarget}
        onClose={() => setMoveTarget(null)}
        onSubmit={(parentId) => void changeParent(parentId)}
      />

      <DeletePositionModal
        open={Boolean(deleteTarget)}
        positions={positions}
        position={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onSubmit={(childrenParentId) => void deletePosition(childrenParentId)}
      />
    </main>
  );
}
