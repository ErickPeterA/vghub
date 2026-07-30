export type PositionStatus = "active" | "inactive";

export type OrganizationPosition = {
  id: string;
  project_id: string;
  parent_id: string | null;
  nome: string;
  descricao: string | null;
  display_order: number;
  status: PositionStatus;
  created_by: string | null;
  created_at: string;
  updated_at?: string;
};

export type OrganizationNodeData = OrganizationPosition & {
  children: OrganizationNodeData[];
  depth: number;
};

export function sortPositions(a: OrganizationPosition, b: OrganizationPosition) {
  if (a.display_order !== b.display_order) return a.display_order - b.display_order;
  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
}

export function buildOrganizationTree(positions: OrganizationPosition[]) {
  const nodeById = new Map<string, OrganizationNodeData>();
  positions.forEach((position) => {
    nodeById.set(position.id, { ...position, children: [], depth: 0 });
  });

  const roots: OrganizationNodeData[] = [];
  nodeById.forEach((node) => {
    const parent = node.parent_id ? nodeById.get(node.parent_id) : null;
    if (parent) parent.children.push(node);
    else roots.push(node);
  });

  const assignDepth = (node: OrganizationNodeData, depth: number) => {
    node.depth = depth;
    node.children.sort(sortPositions);
    node.children.forEach((child) => assignDepth(child, depth + 1));
  };

  roots.sort(sortPositions);
  roots.forEach((root) => assignDepth(root, 0));
  return roots;
}

export function getChildren(positions: OrganizationPosition[], parentId: string | null) {
  return positions.filter((position) => position.parent_id === parentId).sort(sortPositions);
}

export function getDescendantIds(positions: OrganizationPosition[], positionId: string) {
  const result = new Set<string>();
  const visit = (id: string) => {
    getChildren(positions, id).forEach((child) => {
      result.add(child.id);
      visit(child.id);
    });
  };
  visit(positionId);
  return result;
}

export function getAncestorIds(positions: OrganizationPosition[], positionId: string) {
  const result = new Set<string>();
  const byId = new Map(positions.map((position) => [position.id, position]));
  let current = byId.get(positionId);
  while (current?.parent_id) {
    result.add(current.parent_id);
    current = byId.get(current.parent_id);
  }
  return result;
}

export function countDescendants(positions: OrganizationPosition[], positionId: string) {
  return getDescendantIds(positions, positionId).size;
}

export function availableParents(
  positions: OrganizationPosition[],
  position?: OrganizationPosition | null,
) {
  if (!position) return positions;
  const blocked = getDescendantIds(positions, position.id);
  blocked.add(position.id);
  return positions.filter((candidate) => !blocked.has(candidate.id));
}

export function flattenTree(nodes: OrganizationNodeData[]) {
  const result: OrganizationNodeData[] = [];
  const visit = (node: OrganizationNodeData) => {
    result.push(node);
    node.children.forEach(visit);
  };
  nodes.forEach(visit);
  return result;
}
