import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { OrganizationPosition } from "@/lib/organization";
import { availableParents } from "@/lib/organization";

type ChangeParentModalProps = {
  open: boolean;
  positions: OrganizationPosition[];
  position: OrganizationPosition | null;
  onClose: () => void;
  onSubmit: (parentId: string | null) => void;
};

export function ChangeParentModal({ open, positions, position, onClose, onSubmit }: ChangeParentModalProps) {
  const [parentId, setParentId] = useState<string | null>(null);

  useEffect(() => {
    if (open) setParentId(position?.parent_id ?? null);
  }, [open, position]);

  const options = availableParents(positions, position);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Alterar superior imediato</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-[#042558]/60">
            Escolha o novo superior de <strong>{position?.nome}</strong>. Os subordinados atuais permanecem abaixo dele.
          </p>
          <select
            value={parentId ?? ""}
            onChange={(event) => setParentId(event.target.value || null)}
            className="w-full rounded-lg border border-[#042558]/20 bg-white px-3 py-2 text-sm text-[#042558] outline-none focus:border-[#042558]"
          >
            <option value="">Sem superior imediato</option>
            {options.map((option) => (
              <option key={option.id} value={option.id}>{option.nome}</option>
            ))}
          </select>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-[#042558]/20 bg-white px-4 py-2 text-sm font-medium text-[#042558] hover:bg-[#042558]/5">
              Cancelar
            </button>
            <button type="button" onClick={() => onSubmit(parentId)} className="rounded-lg bg-[#042558] px-4 py-2 text-sm font-medium text-white hover:bg-[#042558]/90">
              Alterar
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
