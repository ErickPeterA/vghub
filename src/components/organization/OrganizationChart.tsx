import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  type ReactFlowInstance,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { CheckCircle2, FileText, GripHorizontal, Pencil, Plus, Trash2, Unlink } from "lucide-react";
import type { ConnectionHandle, OrganizationPosition } from "@/lib/organization";
import { countDescendants } from "@/lib/organization";

type CanvasNodeData = {
  position: OrganizationPosition;
  hasDescription: boolean;
  highlighted: boolean;
  descendants: number;
  onSelect: (position: OrganizationPosition) => void;
  onEdit: (position: OrganizationPosition) => void;
  onAddChild: (position: OrganizationPosition) => void;
  onDelete: (position: OrganizationPosition) => void;
};

type CanvasNode = Node<CanvasNodeData, "position">;

type OrganizationChartProps = {
  positions: OrganizationPosition[];
  positionsWithDescription: Set<string>;
  highlightedId: string | null;
  onSelect: (position: OrganizationPosition) => void;
  onEdit: (position: OrganizationPosition) => void;
  onAddChild: (position: OrganizationPosition) => void;
  onDelete: (position: OrganizationPosition) => void;
  onCreateAt: (x: number, y: number) => void;
  onMovePositions: (updates: Array<{ id: string; x: number; y: number }>) => Promise<void>;
  onConnect: (
    parentId: string,
    childId: string,
    sourceHandle: ConnectionHandle,
    targetHandle: ConnectionHandle,
  ) => Promise<void>;
  onDisconnect: (childId: string) => Promise<void>;
};

const NODE_WIDTH = 272;
const NODE_HEIGHT = 138;
const defaultEdgeStyle = { stroke: "#54739b", strokeWidth: 1.6 };
const selectedEdgeStyle = {
  stroke: "#f59e0b",
  strokeWidth: 4,
  filter: "drop-shadow(0 0 4px rgba(245, 158, 11, 0.65))",
};
const connectionHandles: Array<{ id: ConnectionHandle; position: Position; title: string }> = [
  { id: "top", position: Position.Top, title: "Conectar por cima" },
  { id: "right", position: Position.Right, title: "Conectar pela direita" },
  { id: "bottom", position: Position.Bottom, title: "Conectar por baixo" },
  { id: "left", position: Position.Left, title: "Conectar pela esquerda" },
];

function fallbackPositions(positions: OrganizationPosition[]) {
  const byId = new Map(positions.map((position) => [position.id, position]));
  const depthCache = new Map<string, number>();
  const depthOf = (position: OrganizationPosition, seen = new Set<string>()): number => {
    const cached = depthCache.get(position.id);
    if (cached !== undefined) return cached;
    if (!position.parent_id || seen.has(position.id)) return 0;
    const parent = byId.get(position.parent_id);
    if (!parent) return 0;
    seen.add(position.id);
    const depth = depthOf(parent, seen) + 1;
    depthCache.set(position.id, depth);
    return depth;
  };

  const rows = new Map<number, OrganizationPosition[]>();
  positions.forEach((position) => {
    const depth = depthOf(position);
    const row = rows.get(depth) ?? [];
    row.push(position);
    rows.set(depth, row);
  });

  const result = new Map<string, { x: number; y: number }>();
  rows.forEach((row, depth) => {
    row
      .sort((left, right) => left.display_order - right.display_order)
      .forEach((position, index) => {
        result.set(position.id, { x: index * 340 + 80, y: depth * 220 + 80 });
      });
  });
  return result;
}

function PositionCanvasNode({ data, selected }: NodeProps<CanvasNode>) {
  const position = data.position;
  return (
    <div
      data-position-id={position.id}
      className={`relative w-[272px] rounded-2xl border bg-white shadow-md transition-shadow ${
        selected
          ? "border-[#042558] shadow-lg ring-4 ring-[#042558]/10"
          : data.highlighted
            ? "border-amber-400 ring-4 ring-amber-200/60"
            : "border-[#042558]/15 hover:shadow-lg"
      }`}
    >
      {connectionHandles.map((handle) => (
        <Handle
          key={handle.id}
          id={handle.id}
          type="source"
          position={handle.position}
          className="!h-3.5 !w-3.5 !border-2 !border-white !bg-[#2f6fed] transition-transform hover:!scale-150"
          title={handle.title}
        />
      ))}

      <div className="position-drag-handle flex cursor-grab items-center justify-between rounded-t-2xl border-b border-[#042558]/10 bg-[#f4f7fb] px-3 py-2 active:cursor-grabbing">
        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#042558]/45">
          Cargo
        </span>
        <GripHorizontal className="h-4 w-4 text-[#042558]/35" />
      </div>

      <button
        type="button"
        onClick={() => data.onSelect(position)}
        className="block w-full px-4 py-3 text-left"
      >
        <span className="block truncate text-sm font-bold text-[#042558]" title={position.nome}>
          {position.nome}
        </span>
        <span
          className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            data.hasDescription
              ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
              : "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
          }`}
        >
          {data.hasDescription ? (
            <CheckCircle2 className="h-3 w-3" />
          ) : (
            <FileText className="h-3 w-3" />
          )}
          {data.hasDescription ? "Descrição criada" : "Sem descrição"}
        </span>
        <span className="mt-2 block text-[11px] text-[#042558]/45">
          {position.status === "active" ? "Ativo" : "Inativo"} · {data.descendants} abaixo
        </span>
      </button>

      <div className="nodrag flex items-center justify-end gap-1 border-t border-[#042558]/10 px-2 py-1.5">
        <button
          type="button"
          onClick={() => data.onAddChild(position)}
          className="rounded-md p-1.5 text-[#042558]/55 hover:bg-[#042558]/8 hover:text-[#042558]"
          title="Criar cargo conectado abaixo"
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => data.onEdit(position)}
          className="rounded-md p-1.5 text-[#042558]/55 hover:bg-[#042558]/8 hover:text-[#042558]"
          title="Editar cargo"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => data.onDelete(position)}
          className="rounded-md p-1.5 text-red-500/75 hover:bg-red-50 hover:text-red-600"
          title="Excluir cargo"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

const nodeTypes = { position: PositionCanvasNode };

export function OrganizationChart({
  positions,
  positionsWithDescription,
  highlightedId,
  onSelect,
  onEdit,
  onAddChild,
  onDelete,
  onCreateAt,
  onMovePositions,
  onConnect,
  onDisconnect,
}: OrganizationChartProps) {
  const instanceRef = useRef<ReactFlowInstance<CanvasNode, Edge> | null>(null);
  const fallback = useMemo(() => fallbackPositions(positions), [positions]);

  const mappedNodes = useMemo<CanvasNode[]>(
    () =>
      positions.map((position) => ({
        id: position.id,
        type: "position",
        position: {
          x: position.layout_x ?? fallback.get(position.id)?.x ?? 0,
          y: position.layout_y ?? fallback.get(position.id)?.y ?? 0,
        },
        data: {
          position,
          hasDescription: positionsWithDescription.has(position.id),
          highlighted: highlightedId === position.id,
          descendants: countDescendants(positions, position.id),
          onSelect,
          onEdit,
          onAddChild,
          onDelete,
        },
        dragHandle: ".position-drag-handle",
        deletable: false,
      })),
    [
      fallback,
      highlightedId,
      onAddChild,
      onDelete,
      onEdit,
      onSelect,
      positions,
      positionsWithDescription,
    ],
  );

  const mappedEdges = useMemo<Edge[]>(
    () =>
      positions
        .filter((position) => position.parent_id)
        .map((position) => ({
          id: `leader-${position.id}`,
          source: position.parent_id!,
          target: position.id,
          sourceHandle: position.connection_source_handle ?? "right",
          targetHandle: position.connection_target_handle ?? "left",
          type: "smoothstep",
          markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
          style: defaultEdgeStyle,
          interactionWidth: 28,
        })),
    [positions],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasNode>(mappedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(mappedEdges);

  useEffect(() => setNodes(mappedNodes), [mappedNodes, setNodes]);
  useEffect(() => setEdges(mappedEdges), [mappedEdges, setEdges]);

  const highlightEdge = useCallback(
    (edgeId: string | null) => {
      setEdges((current) =>
        current.map((edge) => {
          const isSelected = edge.id === edgeId;
          return {
            ...edge,
            selected: isSelected,
            animated: isSelected,
            style: isSelected ? selectedEdgeStyle : defaultEdgeStyle,
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: isSelected ? 22 : 18,
              height: isSelected ? 22 : 18,
              color: isSelected ? "#f59e0b" : "#54739b",
            },
          };
        }),
      );
    },
    [setEdges],
  );

  useEffect(() => {
    if (!highlightedId) return;
    const node = nodes.find((candidate) => candidate.id === highlightedId);
    if (!node) return;
    instanceRef.current?.setCenter(
      node.position.x + NODE_WIDTH / 2,
      node.position.y + NODE_HEIGHT / 2,
      { zoom: 1.15, duration: 500 },
    );
  }, [highlightedId, nodes]);

  const handleConnect = useCallback(
    async (connection: Connection) => {
      if (!connection.source || !connection.target || connection.source === connection.target)
        return;
      await onConnect(
        connection.source,
        connection.target,
        (connection.sourceHandle as ConnectionHandle | null) ?? "right",
        (connection.targetHandle as ConnectionHandle | null) ?? "left",
      );
    },
    [onConnect],
  );

  return (
    <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-[#042558]/10 bg-[#f8fafc] shadow-inner">
      <ReactFlow<CanvasNode, Edge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onInit={(instance) => {
          instanceRef.current = instance;
          window.requestAnimationFrame(() => instance.fitView({ padding: 0.18, maxZoom: 1 }));
        }}
        onNodeClick={(_, node) => onSelect(node.data.position)}
        onNodeDragStop={(_, node) => {
          const movedNodes = nodes.filter(
            (candidate) => candidate.selected || candidate.id === node.id,
          );
          void onMovePositions(
            movedNodes.map((candidate) => ({
              id: candidate.id,
              x: candidate.id === node.id ? node.position.x : candidate.position.x,
              y: candidate.id === node.id ? node.position.y : candidate.position.y,
            })),
          );
        }}
        onConnect={(connection) => void handleConnect(connection)}
        onEdgeClick={(event, edge) => {
          event.stopPropagation();
          highlightEdge(edge.id);
        }}
        onEdgesDelete={(deleted) => deleted.forEach((edge) => void onDisconnect(edge.target))}
        onPaneClick={(event) => {
          if (event.detail === 1) {
            highlightEdge(null);
            return;
          }
          if (event.detail !== 2) return;
          const point = instanceRef.current?.screenToFlowPosition({
            x: event.clientX,
            y: event.clientY,
          });
          if (point) onCreateAt(point.x, point.y);
        }}
        fitView
        minZoom={0.2}
        maxZoom={2}
        snapToGrid
        snapGrid={[16, 16]}
        deleteKeyCode={["Backspace", "Delete"]}
        panOnScroll
        multiSelectionKeyCode="Shift"
        defaultEdgeOptions={{ type: "smoothstep" }}
        connectionMode={ConnectionMode.Loose}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.25} color="#b8c5d6" />
        <Controls position="bottom-left" showInteractive={false} />
        <MiniMap
          position="bottom-right"
          pannable
          zoomable
          nodeColor={(node) =>
            (node.data as CanvasNodeData).position.status === "active" ? "#2f6fed" : "#94a3b8"
          }
          maskColor="rgba(241, 245, 249, 0.75)"
        />
        <Panel position="top-left" className="!m-3">
          <div className="rounded-lg border border-[#042558]/10 bg-white/90 px-3 py-2 text-[11px] leading-5 text-[#042558]/60 shadow-sm backdrop-blur">
            <strong className="block text-[#042558]">Canvas livre</strong>
            Arraste os cargos · conecte pelas bolinhas · duplo clique para criar
          </div>
        </Panel>
        <Panel position="top-right" className="!m-3">
          <button
            type="button"
            onClick={() => {
              const selectedEdge = edges.find((edge) => edge.selected);
              if (!selectedEdge) return;
              setEdges((current) => current.filter((edge) => edge.id !== selectedEdge.id));
              void onDisconnect(selectedEdge.target);
            }}
            disabled={!edges.some((edge) => edge.selected)}
            className="inline-flex items-center gap-2 rounded-lg border border-[#042558]/10 bg-white/90 px-3 py-2 text-xs font-semibold text-[#042558] shadow-sm hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
            title="Selecione uma conexão e clique para removê-la"
          >
            <Unlink className="h-3.5 w-3.5" /> Remover conexão
          </button>
        </Panel>
      </ReactFlow>
    </div>
  );
}
