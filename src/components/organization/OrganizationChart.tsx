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
  onDropOn: (sourceId: string, target: OrganizationPosition) => void;
};

export function OrganizationChart(props: OrganizationChartProps) {
  return (
    <div className="h-[calc(100vh-280px)] min-h-[520px] overflow-auto rounded-2xl border border-[#042558]/10 bg-white/55 p-8 shadow-inner">
      <div
        className="inline-flex min-w-full justify-center py-8 transition-transform"
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
