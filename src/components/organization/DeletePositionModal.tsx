import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { OrganizationPosition } from "@/lib/organization";
import { availableParents, getChildren } from "@/lib/organization";

type DeleteMode = "currentParent" | "chosenParent" | "root";

type DeletePositionModalProps = {
  open: boolean;
  positions: OrganizationPosition[];
  position: OrganizationPosition | null;
  onClose: () => void;
  onSubmit: (childrenParentId: string | null) => void;
};

export function DeletePositionModal({ open, positions, position, onClose, onSubmit }: DeletePositionModalProps) {
  const [mode, setMode] = useState<DeleteMode>("currentParent");
  const [chosenParentId, setChosenParentId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMode("currentParent");
    setChosenParentId(null);
  }, [open]);

  const children = position ? getChildren(positions, position.id) : [];
  const options = availableParents(positions, position).filter((item) => item.id !== position?.parent_id);

  if (!position) return null;

  const submit = () => {
    if (children.length === 0) {
      onSubmit(null);
      return;
    }
    if (mode === "currentParent") onSubmit(position.parent_id);
    if (mode === "chosenParent") onSubmit(chosenParentId);
    if (mode === "root") onSubmit(null);
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Excluir cargo</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-[#042558]/65">
            Você está excluindo <strong>{position.nome}</strong>.
          </p>

          {children.length === 0 ? (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">Este cargo não possui subordinados. Confirme para excluir.</p>
          ) : (
            <>
              <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                Este cargo possui {children.length} subordinado(s). Eles não serão excluídos automaticamente.
              </p>
              <div className="space-y-2">
                <label className="flex items-center gap-2 rounded-lg border border-[#042558]/10 p-3 text-sm text-[#042558]">
                  <input type="radio" checked={mode === "currentParent"} onChange={() => setMode("currentParent")} />
                  Repassar os subordinados para o superior atual do cargo
                </label>
                <label className="flex items-center gap-2 rounded-lg border border-[#042558]/10 p-3 text-sm text-[#042558]">
                  <input type="radio" checked={mode === "chosenParent"} onChange={() => setMode("chosenParent")} />
                  Escolher outro superior para os subordinados
                </label>
                {mode === "chosenParent" && (
                  <select
                    value={chosenParentId ?? ""}
                    onChange={(event) => setChosenParentId(event.target.value || null)}
                    className="w-full rounded-lg border border-[#042558]/20 bg-white px-3 py-2 text-sm text-[#042558] outline-none focus:border-[#042558]"
                  >
                    <option value="">Sem superior imediato</option>
                    {options.map((option) => (
                      <option key={option.id} value={option.id}>{option.nome}</option>
                    ))}
                  </select>
                )}
                <label className="flex items-center gap-2 rounded-lg border border-[#042558]/10 p-3 text-sm text-[#042558]">
                  <input type="radio" checked={mode === "root"} onChange={() => setMode("root")} />
                  Deixar os subordinados sem superior imediato
                </label>
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-[#042558]/20 bg-white px-4 py-2 text-sm font-medium text-[#042558] hover:bg-[#042558]/5">
              Cancelar
            </button>
            <button type="button" onClick={submit} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
              Excluir cargo
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
