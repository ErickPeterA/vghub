import { Pencil, Plus, X, MoveDown } from "lucide-react";
import type { OrganizationPosition } from "@/lib/organization";
import { countDescendants, getChildren } from "@/lib/organization";

type PositionDetailsPanelProps = {
  position: OrganizationPosition | null;
  positions: OrganizationPosition[];
  onClose: () => void;
  onEdit: (position: OrganizationPosition) => void;
  onMove: (position: OrganizationPosition) => void;
  onAddChild: (position: OrganizationPosition) => void;
};

export function PositionDetailsPanel({ position, positions, onClose, onEdit, onMove, onAddChild }: PositionDetailsPanelProps) {
  if (!position) return null;

  const parent = position.parent_id ? positions.find((item) => item.id === position.parent_id) : null;
  const children = getChildren(positions, position.id);
  const totalBelow = countDescendants(positions, position.id);

  return (
    <aside className="fixed inset-y-0 right-0 z-40 w-full max-w-md overflow-y-auto border-l border-[#042558]/10 bg-white p-6 shadow-2xl">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#042558]/45">Cargo</p>
          <h2 className="mt-1 text-xl font-bold text-[#042558]">{position.nome}</h2>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg p-2 text-[#042558]/45 hover:bg-[#042558]/10 hover:text-[#042558]">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="grid gap-3">
        <Info label="Descrição" value={position.descricao || "Sem descrição"} multiline />
        <Info label="Superior imediato" value={parent?.nome ?? "Sem superior imediato"} />
        <Info label="Subordinados diretos" value={`${children.length}`} />
        <Info label="Total de cargos abaixo" value={`${totalBelow}`} />
        <Info label="Status" value={position.status === "active" ? "Ativo" : "Inativo"} />
        <Info label="Criado em" value={new Date(position.created_at).toLocaleString("pt-BR")} />
        <Info label="Usuário que criou" value={position.created_by ?? "Não informado"} />
      </div>

      {children.length > 0 && (
        <div className="mt-6">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#042558]/45">Subordinados diretos</h3>
          <div className="mt-2 space-y-2">
            {children.map((child) => (
              <div key={child.id} className="rounded-lg border border-[#042558]/10 bg-[#042558]/5 px-3 py-2 text-sm font-medium text-[#042558]">
                {child.nome}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-2">
        <button type="button" onClick={() => onEdit(position)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#042558] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#042558]/90">
          <Pencil className="h-4 w-4" />
          Editar
        </button>
        <button type="button" onClick={() => onMove(position)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#042558]/20 bg-white px-4 py-2.5 text-sm font-medium text-[#042558] hover:bg-[#042558]/5">
          <MoveDown className="h-4 w-4" />
          Alterar superior
        </button>
        <button type="button" onClick={() => onAddChild(position)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#042558]/20 bg-white px-4 py-2.5 text-sm font-medium text-[#042558] hover:bg-[#042558]/5">
          <Plus className="h-4 w-4" />
          Adicionar subordinado
        </button>
      </div>
    </aside>
  );
}

function Info({ label, value, multiline = false }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div className="rounded-xl border border-[#042558]/10 bg-[#042558]/5 p-3">
      <dt className="text-xs font-medium text-[#042558]/50">{label}</dt>
      <dd className={`mt-1 text-sm text-[#042558] ${multiline ? "whitespace-pre-wrap leading-6" : ""}`}>{value}</dd>
    </div>
  );
}
