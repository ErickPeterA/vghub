import { useEffect, useMemo, useRef, useState } from "react";
import type { OrganizationNodeData, OrganizationPosition } from "@/lib/organization";
import { countDescendants } from "@/lib/organization";
import { Plus } from "lucide-react";
import { OrganizationNode } from "./OrganizationNode";

type OrganizationChartProps = {
  nodes: OrganizationNodeData[];
  positions: OrganizationPosition[];
  zoom: number;
  collapsed: Set<string>;
  selectedId: string | null;
  highlightedId: string | null;
  onZoomChange: (zoom: number) => void;
  onSelect: (position: OrganizationPosition) => void;
  onToggle: (id: string) => void;
  onAddAt: (parentId: string | null, displayOrder: number) => void;
  onAddChild: (position: OrganizationPosition) => void;
  onAddSibling: (position: OrganizationPosition) => void;
  onInsertAbove: (position: OrganizationPosition) => void;
  onEdit: (position: OrganizationPosition) => void;
  onMove: (position: OrganizationPosition) => void;
  onDelete: (position: OrganizationPosition) => void;
  onReorder: (position: OrganizationPosition, direction: "up" | "down") => void;
  onDropOn: (sourceId: string, target: OrganizationPosition, placement: "before" | "inside" | "after") => void;
};

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 1.6;

function clampZoom(value: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(value.toFixed(2))));
}

function getPageScroller() {
  const scroller = document.scrollingElement as HTMLElement | null;
  if (!scroller || scroller.scrollWidth <= scroller.clientWidth) return null;
  return scroller;
}

export function OrganizationChart(props: OrganizationChartProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number; pageScrollLeft: number | null } | null>(
    null,
  );
  const [isPanning, setIsPanning] = useState(false);
  const nodesKey = useMemo(() => props.nodes.map((node) => node.id).join("|"), [props.nodes]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    window.requestAnimationFrame(() => {
      viewport.scrollLeft = Math.max(0, (viewport.scrollWidth - viewport.clientWidth) / 2);
      viewport.scrollTop = 0;
    });
  }, [nodesKey]);

  const canStartPan = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false;
    return !target.closest("[data-position-id], button, input, textarea, select, a, [role='menuitem']");
  };

  return (
    <div
      ref={viewportRef}
      onWheel={(event) => {
        event.preventDefault();
        const viewport = viewportRef.current;
        if (!viewport) return;

        const nextZoom = clampZoom(props.zoom + (event.deltaY > 0 ? -0.08 : 0.08));
        if (nextZoom === props.zoom) return;

        const rect = viewport.getBoundingClientRect();
        const pointerX = event.clientX - rect.left;
        const pointerY = event.clientY - rect.top;
        const contentX = viewport.scrollLeft + pointerX;
        const contentY = viewport.scrollTop + pointerY;
        const ratio = nextZoom / props.zoom;

        props.onZoomChange(nextZoom);
        window.requestAnimationFrame(() => {
          viewport.scrollLeft = contentX * ratio - pointerX;
          viewport.scrollTop = contentY * ratio - pointerY;
        });
      }}
      onPointerDown={(event) => {
        if (event.button !== 0 || !canStartPan(event.target)) return;
        const viewport = viewportRef.current;
        if (!viewport) return;

        dragStateRef.current = {
          x: event.clientX,
          y: event.clientY,
          scrollLeft: viewport.scrollLeft,
          scrollTop: viewport.scrollTop,
          pageScrollLeft: getPageScroller()?.scrollLeft ?? null,
        };
        setIsPanning(true);
        viewport.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const viewport = viewportRef.current;
        const dragState = dragStateRef.current;
        if (!viewport || !dragState) return;

        event.preventDefault();
        const deltaX = event.clientX - dragState.x;
        const pageScroller = getPageScroller();
        if (pageScroller && dragState.pageScrollLeft !== null) {
          pageScroller.scrollLeft = dragState.pageScrollLeft - deltaX;
        } else {
          viewport.scrollLeft = dragState.scrollLeft - deltaX;
        }
        viewport.scrollTop = dragState.scrollTop - (event.clientY - dragState.y);
      }}
      onPointerUp={(event) => {
        const viewport = viewportRef.current;
        dragStateRef.current = null;
        setIsPanning(false);
        if (viewport?.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={(event) => {
        const viewport = viewportRef.current;
        dragStateRef.current = null;
        setIsPanning(false);
        if (viewport?.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
      }}
      className={`min-h-0 flex-1 overflow-auto rounded-xl border border-[#042558]/10 bg-white/55 p-4 shadow-inner sm:p-6 ${
        isPanning ? "cursor-grabbing select-none" : "cursor-grab"
      }`}
    >
      <div
        className="mx-auto flex min-h-full min-w-max justify-center px-6 py-6 transition-transform sm:px-10"
        style={{ transform: `scale(${props.zoom})`, transformOrigin: "top center" }}
      >
        <div className="flex items-start justify-center gap-4">
          <OrganizationSiblingRow parentId={null} nodes={props.nodes} {...props} />
        </div>
      </div>
    </div>
  );
}

function getAppendDisplayOrder(nodes: OrganizationNodeData[]) {
  return nodes.length > 0 ? Math.max(...nodes.map((node) => node.display_order)) + 10 : 10;
}

function getInsertDisplayOrder(previous: OrganizationNodeData) {
  return previous.display_order + 1;
}

function AddPositionButton({ title, onClick }: { title: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#042558]/20 bg-white text-[#042558] shadow-sm transition hover:border-[#042558] hover:bg-[#042558] hover:text-white"
    >
      <Plus className="h-4 w-4" />
    </button>
  );
}

function OrganizationSiblingRow({
  parentId,
  nodes,
  withIncomingLine = false,
  ...props
}: Omit<OrganizationChartProps, "nodes"> & { parentId: string | null; nodes: OrganizationNodeData[]; withIncomingLine?: boolean }) {
  const hasMultipleNodes = nodes.length > 1;
  const addButtonTopClass = withIncomingLine ? "top-[5.25rem]" : "top-16";

  return (
    <div className="flex items-start justify-center gap-10">
      {nodes.map((child, index) => (
        <div key={child.id} className="relative flex flex-col items-center">
          {withIncomingLine && (
            <div className="relative h-5 w-full">
              {hasMultipleNodes && index > 0 && <div className="absolute -left-5 right-1/2 top-0 border-t border-[#042558]/25" />}
              {hasMultipleNodes && index < nodes.length - 1 && <div className="absolute left-1/2 -right-5 top-0 border-t border-[#042558]/25" />}
              <div className="absolute left-1/2 top-0 h-5 -translate-x-1/2 border-l border-[#042558]/25" />
            </div>
          )}
          <OrganizationBranch node={child} {...props} />

          <div className={`absolute -right-9 ${addButtonTopClass} z-10 flex h-8 items-center`}>
            <AddPositionButton
              title={index === nodes.length - 1 ? "Adicionar cargo no final" : "Adicionar cargo entre estes cargos"}
              onClick={() => props.onAddAt(parentId, index === nodes.length - 1 ? getAppendDisplayOrder(nodes) : getInsertDisplayOrder(child))}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function OrganizationBranch({ node, ...props }: Omit<OrganizationChartProps, "nodes"> & { node: OrganizationNodeData }) {
  const isCollapsed = props.collapsed.has(node.id);
  const visibleChildren = isCollapsed ? [] : node.children;

  return (
    <div className="flex flex-col items-center">
      <OrganizationNode
        node={node}
        selected={props.selectedId === node.id}
        highlighted={props.highlightedId === node.id}
        collapsed={isCollapsed}
        descendantCount={countDescendants(props.positions, node.id)}
        onSelect={props.onSelect}
        onToggle={props.onToggle}
        onAddChild={props.onAddChild}
        onAddSibling={props.onAddSibling}
        onInsertAbove={props.onInsertAbove}
        onEdit={props.onEdit}
        onMove={props.onMove}
        onDelete={props.onDelete}
        onReorder={props.onReorder}
        onDropOn={props.onDropOn}
      />

      {visibleChildren.length > 0 && (
        <div className="mt-5 flex flex-col items-center">
          <div className="h-5 border-l border-[#042558]/25" />
          <OrganizationSiblingRow parentId={node.id} nodes={visibleChildren} withIncomingLine {...props} />
        </div>
      )}

      {visibleChildren.length === 0 && !isCollapsed && (
        <div className="mt-5 flex flex-col items-center">
          <div className="h-5 border-l border-[#042558]/25" />
          <AddPositionButton title="Adicionar subordinado" onClick={() => props.onAddAt(node.id, 10)} />
        </div>
      )}
    </div>
  );
}
