import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { FileText, Loader2, MoveDown, Pencil, Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { OrganizationPosition } from "@/lib/organization";
import { getChildren } from "@/lib/organization";

type LinkedDescription = {
  id: string;
  cargo: string;
};

type PositionDetailsPanelProps = {
  projectId: string;
  position: OrganizationPosition | null;
  positions: OrganizationPosition[];
  onClose: () => void;
  onEdit: (position: OrganizationPosition) => void;
  onMove: (position: OrganizationPosition) => void;
  onAddChild: (position: OrganizationPosition) => void;
};

export function PositionDetailsPanel({ projectId, position, positions, onClose, onEdit, onMove, onAddChild }: PositionDetailsPanelProps) {
  const navigate = useNavigate();
  const [linkedDescription, setLinkedDescription] = useState<LinkedDescription | null>(null);
  const [loadingDescription, setLoadingDescription] = useState(false);

  useEffect(() => {
    if (!position) {
      setLinkedDescription(null);
      return;
    }

    let cancelled = false;
    setLoadingDescription(true);
    void (supabase as any)
      .from("descricoes_cargo")
      .select("id,cargo")
      .eq("project_id", projectId)
      .eq("organization_position_id", position.id)
      .maybeSingle()
      .then(({ data }: { data: LinkedDescription | null }) => {
        if (!cancelled) setLinkedDescription(data ?? null);
      })
      .finally(() => {
        if (!cancelled) setLoadingDescription(false);
      });

    return () => {
      cancelled = true;
    };
  }, [position, projectId]);

  if (!position) return null;

  const children = getChildren(positions, position.id);

  const openDescription = () => {
    if (linkedDescription) {
      navigate({ to: "/projetos/$projectId/descricao-cargo/$dcId", params: { projectId, dcId: linkedDescription.id } });
      return;
    }

    navigate({
      to: "/projetos/$projectId/descricao-cargo/novo",
      params: { projectId },
      search: { positionId: position.id } as never,
    });
  };

  return (
    <aside className="fixed inset-y-0 right-0 z-40 w-full max-w-md overflow-y-auto border-l border-[#042558]/10 bg-white p-6 shadow-2xl">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#042558]/45">Cargo</p>
          <h2 className="mt-1 text-xl font-bold text-[#042558]">{position.nome}</h2>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg p-2 text-[#042558]/45 hover:bg-[#042558]/10 hover:text-[#042558]">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[#042558]/45">Subordinados diretos</h3>
        <div className="mt-2 space-y-2">
          {children.length === 0 ? (
            <p className="rounded-lg border border-dashed border-[#042558]/15 bg-[#042558]/5 px-3 py-3 text-sm text-[#042558]/55">
              Nenhum subordinado direto.
            </p>
          ) : (
            children.map((child) => (
              <div key={child.id} className="rounded-lg border border-[#042558]/10 bg-[#042558]/5 px-3 py-2 text-sm font-medium text-[#042558]">
                {child.nome}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-2">
        <button
          type="button"
          onClick={openDescription}
          disabled={loadingDescription}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#042558] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#042558]/90 disabled:opacity-60"
        >
          {loadingDescription ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
          {linkedDescription ? "Abrir descrição de cargo" : "Criar descrição de cargo"}
        </button>
        <button type="button" onClick={() => onEdit(position)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#042558]/20 bg-white px-4 py-2.5 text-sm font-medium text-[#042558] hover:bg-[#042558]/5">
          <Pencil className="h-4 w-4" />
          Editar cargo
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
