import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileText,
  MoreVertical,
  MoveDown,
  MoveUp,
  Pencil,
  Plus,
  Trash2,
  UserPlus,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { OrganizationNodeData, OrganizationPosition } from "@/lib/organization";

type OrganizationNodeProps = {
  node: OrganizationNodeData;
  selected: boolean;
  highlighted: boolean;
  collapsed: boolean;
  descendantCount: number;
  hasDescription: boolean;
  onSelect: (position: OrganizationPosition) => void;
  onToggle: (id: string) => void;
  onAddChild: (position: OrganizationPosition) => void;
  onAddSibling: (position: OrganizationPosition) => void;
  onInsertAbove: (position: OrganizationPosition) => void;
  onEdit: (position: OrganizationPosition) => void;
  onMove: (position: OrganizationPosition) => void;
  onDelete: (position: OrganizationPosition) => void;
  onReorder: (position: OrganizationPosition, direction: "up" | "down") => void;
  onDropOn: (
    sourceId: string,
    target: OrganizationPosition,
    placement: "before" | "inside" | "after",
  ) => void;
};

export function OrganizationNode({
  node,
  selected,
  highlighted,
  collapsed,
  descendantCount,
  hasDescription,
  onSelect,
  onToggle,
  onAddChild,
  onAddSibling,
  onInsertAbove,
  onEdit,
  onMove,
  onDelete,
  onReorder,
  onDropOn,
}: OrganizationNodeProps) {
  const hasChildren = node.children.length > 0;

  return (
    <div
      data-position-id={node.id}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", node.id);
        event.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const sourceId = event.dataTransfer.getData("text/plain");
        if (sourceId) {
          const rect = event.currentTarget.getBoundingClientRect();
          const x = event.clientX - rect.left;
          const placement =
            x < rect.width * 0.33 ? "before" : x > rect.width * 0.67 ? "after" : "inside";
          onDropOn(sourceId, node, placement);
        }
      }}
      className={`group relative w-64 rounded-xl border bg-white p-4 text-left shadow-sm transition-all ${
        selected
          ? "border-[#042558] ring-2 ring-[#042558]/15"
          : hasDescription
            ? "border-emerald-300/80 hover:border-emerald-500"
            : "border-[#042558]/10 hover:border-[#042558]/35"
      } ${highlighted ? "bg-amber-50 ring-2 ring-amber-300" : ""}`}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={() => hasChildren && onToggle(node.id)}
          className={`mt-0.5 rounded-md p-1 ${hasChildren ? "text-[#042558]/60 hover:bg-[#042558]/10 hover:text-[#042558]" : "text-transparent"}`}
          title={collapsed ? "Expandir subordinados" : "Recolher subordinados"}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        <button type="button" onClick={() => onSelect(node)} className="min-w-0 flex-1 text-left">
          <span className="block truncate text-sm font-semibold text-[#042558]">{node.nome}</span>
          <span
            className={`mt-2 inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              hasDescription
                ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                : "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
            }`}
            title={
              hasDescription ? "Descricao de cargo criada" : "Descricao de cargo ainda nao criada"
            }
          >
            {hasDescription ? (
              <CheckCircle2 className="h-3 w-3" />
            ) : (
              <FileText className="h-3 w-3" />
            )}
            {hasDescription ? "Descricao criada" : "Sem descricao"}
          </span>
          <span className="mt-1 block text-xs text-[#042558]/45">
            {node.status === "active" ? "Ativo" : "Inativo"} · {descendantCount} abaixo
          </span>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="rounded-md p-1.5 text-[#042558]/45 hover:bg-[#042558]/10 hover:text-[#042558]"
              title="Ações"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => onAddChild(node)}>
              <UserPlus className="mr-2 h-4 w-4" /> Adicionar subordinado
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAddSibling(node)}>
              <Plus className="mr-2 h-4 w-4" /> Adicionar no mesmo nível
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onInsertAbove(node)}>
              <MoveUp className="mr-2 h-4 w-4" /> Inserir cargo acima
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onMove(node)}>
              <MoveDown className="mr-2 h-4 w-4" /> Alterar superior
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(node)}>
              <Pencil className="mr-2 h-4 w-4" /> Editar cargo
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onReorder(node, "up")}>
              Mover para cima
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onReorder(node, "down")}>
              Mover para baixo
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(node)}
              className="text-red-600 focus:text-red-600"
            >
              <Trash2 className="mr-2 h-4 w-4" /> Excluir cargo
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {hasChildren && (
        <span
          className="group/subordinates absolute -bottom-3 left-1/2 z-20 inline-flex min-w-6 -translate-x-1/2 cursor-help items-center justify-center rounded-full bg-[#042558] px-2 py-0.5 text-[10px] font-bold text-white shadow-sm"
          title={`Subordinados diretos: ${node.children.map((child) => child.nome).join(", ")}`}
          aria-label={`${node.children.length} subordinados diretos: ${node.children.map((child) => child.nome).join(", ")}`}
        >
          {node.children.length}
          <span className="pointer-events-none absolute left-1/2 top-full mt-2 hidden w-56 -translate-x-1/2 rounded-lg bg-[#042558] p-2 text-left text-[11px] font-medium leading-4 text-white shadow-lg group-hover/subordinates:block">
            <span className="mb-1 block font-bold">Subordinados diretos</span>
            {node.children.map((child) => (
              <span key={child.id} className="block truncate">
                • {child.nome} · camada {child.visual_level}
              </span>
            ))}
          </span>
        </span>
      )}
    </div>
  );
}
