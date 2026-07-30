import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { OrganizationPosition, PositionStatus } from "@/lib/organization";
import { availableParents } from "@/lib/organization";

type FormMode = "create" | "edit" | "insertAbove";

type PositionFormModalProps = {
  open: boolean;
  mode: FormMode;
  positions: OrganizationPosition[];
  position?: OrganizationPosition | null;
  defaultParentId?: string | null;
  defaultDisplayOrder?: number | null;
  onClose: () => void;
  onSubmit: (values: {
    nome: string;
    descricao: string | null;
    parent_id: string | null;
    display_order: number;
    status: PositionStatus;
  }) => void;
};

const inputClass =
  "w-full rounded-lg border border-[#042558]/20 bg-white px-3 py-2 text-sm text-[#042558] outline-none transition focus:border-[#042558] focus:ring-2 focus:ring-[#042558]/15";

export function PositionFormModal({
  open,
  mode,
  positions,
  position,
  defaultParentId,
  defaultDisplayOrder,
  onClose,
  onSubmit,
}: PositionFormModalProps) {
  const [nome, setNome] = useState("");
  const [parentId, setParentId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setNome(position?.nome ?? "");
    setParentId(mode === "edit" ? (position?.parent_id ?? null) : (defaultParentId ?? null));
  }, [defaultParentId, mode, open, position]);

  const parentOptions = availableParents(positions, mode === "edit" ? position : null);
  const title =
    mode === "edit"
      ? "Editar cargo"
      : mode === "insertAbove"
        ? "Inserir cargo acima"
        : "Novo cargo";
  const hiddenDisplayOrder = position?.display_order ?? defaultDisplayOrder ?? 10;
  const hiddenStatus: PositionStatus = position?.status ?? "active";

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit({
              nome: nome.trim(),
              descricao: position?.descricao ?? null,
              parent_id: parentId,
              display_order: hiddenDisplayOrder,
              status: hiddenStatus,
            });
          }}
        >
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-[#042558]/70">
              Nome do cargo *
            </span>
            <input
              value={nome}
              onChange={(event) => setNome(event.target.value)}
              className={inputClass}
              autoFocus
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-[#042558]/70">
              Superior imediato
            </span>
            <select
              value={parentId ?? ""}
              onChange={(event) => setParentId(event.target.value || null)}
              className={inputClass}
            >
              <option value="">Sem superior imediato</option>
              {parentOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.nome}
                </option>
              ))}
            </select>
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[#042558]/20 bg-white px-4 py-2 text-sm font-medium text-[#042558] hover:bg-[#042558]/5"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#042558] px-4 py-2 text-sm font-medium text-white hover:bg-[#042558]/90"
            >
              Salvar
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
