import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DCForm } from "@/components/DCForm";
import { emptyDC, type DescricaoCargo } from "@/lib/dc-types";
import { useCurrentUser } from "@/hooks/use-current-user";
import { logAction } from "@/lib/history";

export const Route = createFileRoute("/_authenticated/projetos/$projectId/descricao-cargo/novo")({
  component: NovaDC,
});

type LinkedPosition = {
  id: string;
  nome: string;
  parent_id: string | null;
};

function NovaDC() {
  const { projectId } = Route.useParams();
  const { user } = useCurrentUser();
  const navigate = useNavigate();
  const positionId = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("positionId") : null;
  const [linkedPosition, setLinkedPosition] = useState<LinkedPosition | null>(null);
  const [linkedParentName, setLinkedParentName] = useState("");
  const [loadingLinkedPosition, setLoadingLinkedPosition] = useState(Boolean(positionId));

  useEffect(() => {
    if (!positionId) return;

    let cancelled = false;
    setLoadingLinkedPosition(true);
    void (supabase as any)
      .from("project_positions")
      .select("id,nome,parent_id")
      .eq("project_id", projectId)
      .eq("id", positionId)
      .maybeSingle()
      .then(async ({ data, error }: { data: LinkedPosition | null; error: { message: string } | null }) => {
        if (cancelled) return;
        if (error || !data) {
          toast.error(error?.message ?? "Cargo do organograma nao encontrado.");
          setLinkedPosition(null);
          return;
        }

        setLinkedPosition(data);
        if (!data.parent_id) {
          setLinkedParentName("");
          return;
        }

        const { data: parent } = await (supabase as any)
          .from("project_positions")
          .select("nome")
          .eq("project_id", projectId)
          .eq("id", data.parent_id)
          .maybeSingle();
        if (!cancelled) setLinkedParentName(parent?.nome ?? "");
      })
      .finally(() => {
        if (!cancelled) setLoadingLinkedPosition(false);
      });

    return () => {
      cancelled = true;
    };
  }, [positionId, projectId]);

  const initial = useMemo<DescricaoCargo>(() => ({
    ...emptyDC(),
    cargo: linkedPosition?.nome ?? "",
    superior_imediato: linkedParentName,
  }), [linkedParentName, linkedPosition?.nome]);

  const onSubmit = async (dc: DescricaoCargo) => {
    if (!user) return;
    const { id: _omit, ...payload } = dc;
    void _omit;
    const { data, error } = await (supabase as any)
      .from("descricoes_cargo")
      .insert({
        ...payload,
        project_id: projectId,
        created_by: user.id,
        data_versao: payload.data_versao || null,
        data_revisao: payload.data_revisao || null,
        organization_position_id: linkedPosition?.id ?? null,
      })
      .select("id")
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    await logAction({ projectId, acao: "dc_criada", entidade: "descricao_cargo", entidadeId: data.id, detalhes: { cargo: dc.cargo } });
    toast.success("Descricao criada");
    navigate({ to: "/projetos/$projectId/descricao-cargo/$dcId", params: { projectId, dcId: data.id } });
  };

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="mb-6 font-display text-4xl">Nova descricao de cargo</h1>
      {loadingLinkedPosition ? (
        <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">Carregando cargo vinculado...</div>
      ) : (
        <DCForm projectId={projectId} initial={initial} onSubmit={onSubmit} submitLabel="Criar descricao" />
      )}
    </main>
  );
}
