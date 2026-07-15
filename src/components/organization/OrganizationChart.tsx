import type { OrganizationNodeData, OrganizationPosition } from "@/lib/organization";
import { countDescendants } from "@/lib/organization";
import { OrganizationConnections } from "./OrganizationConnections";
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
        <div className="flex items-start justify-center gap-14">
          {props.nodes.map((node) => (
            <OrganizationBranch key={node.id} node={node} {...props} />
          ))}
        </div>
      </div>
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
        <>
          <OrganizationConnections childCount={visibleChildren.length} />
          <div className="flex items-start justify-center gap-10">
            {visibleChildren.map((child) => (
              <div key={child.id} className="relative flex flex-col items-center">
                <div className="h-5 border-l border-[#042558]/25" />
                <OrganizationBranch node={child} {...props} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
