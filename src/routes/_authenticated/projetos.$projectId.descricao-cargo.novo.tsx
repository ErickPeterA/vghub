import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { apiJson } from "@/lib/api";
import { DCForm } from "@/components/DCForm";
import { emptyDC, type DescricaoCargo } from "@/lib/dc-types";
import { logAction } from "@/lib/history";

export const Route = createFileRoute("/_authenticated/projetos/$projectId/descricao-cargo/novo")({
  component: NovaDC,
});

type LinkedPosition = {
  id: string;
  nome: string;
  parent_id: string | null;
};

function validDateOrNull(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

function NovaDC() {
  const { projectId } = Route.useParams();
  const navigate = useNavigate();
  const positionId =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("positionId")
      : null;
  const [linkedPosition, setLinkedPosition] = useState<LinkedPosition | null>(null);
  const [linkedParentName, setLinkedParentName] = useState("");
  const [loadingLinkedPosition, setLoadingLinkedPosition] = useState(Boolean(positionId));

  useEffect(() => {
    if (!positionId) return;

    let cancelled = false;
    setLoadingLinkedPosition(true);
    void (async () => {
      try {
        const { position } = await apiJson<{
          ok: boolean;
          position: (LinkedPosition & { parent_nome?: string | null }) | null;
        }>(`/api/projects/${projectId}/dc?mode=linked-position&positionId=${positionId}`);
        if (cancelled) return;
        if (!position) {
          toast.error("Cargo do organograma nao encontrado.");
          setLinkedPosition(null);
          return;
        }

        setLinkedPosition(position);
        setLinkedParentName(position.parent_nome ?? "");
      } finally {
        if (!cancelled) setLoadingLinkedPosition(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [positionId, projectId]);

  const initial = useMemo<DescricaoCargo>(
    () => ({
      ...emptyDC(),
      organization_position_id: linkedPosition?.id ?? null,
      cargo: linkedPosition?.nome ?? "",
      superior_imediato: linkedParentName,
    }),
    [linkedParentName, linkedPosition?.nome],
  );

  const onSubmit = async (dc: DescricaoCargo) => {
    const { id: _omit, ...payload } = dc;
    void _omit;
    try {
      const { dc: created } = await apiJson<{ ok: boolean; dc: { id: string } }>(
        `/api/projects/${projectId}/dc`,
        {
          method: "POST",
          body: {
            ...payload,
            data_versao: validDateOrNull(payload.data_versao),
            data_revisao: validDateOrNull(payload.data_revisao),
            organization_position_id: linkedPosition?.id ?? null,
          },
        },
      );
      await logAction({
        projectId,
        acao: "dc_criada",
        entidade: "descricao_cargo",
        entidadeId: created.id,
        detalhes: { cargo: dc.cargo },
      });
      toast.success("Descricao criada");
      navigate({
        to: "/projetos/$projectId/descricao-cargo/$dcId",
        params: { projectId, dcId: created.id },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao criar descricao.");
    }
  };
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="mb-6 font-display text-4xl">Nova descricao de cargo</h1>
      {loadingLinkedPosition ? (
        <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
          Carregando cargo vinculado...
        </div>
      ) : (
        <DCForm
          projectId={projectId}
          initial={initial}
          onSubmit={onSubmit}
          submitLabel="Criar descricao"
        />
      )}
    </main>
  );
}

