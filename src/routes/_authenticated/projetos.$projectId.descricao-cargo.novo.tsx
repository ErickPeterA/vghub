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
  const [importedDraft, setImportedDraft] = useState<DescricaoCargo | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);

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

  useEffect(() => {
    if (!positionId) return;
    const key = `dc-import:${projectId}:${positionId}`;
    const saved = sessionStorage.getItem(key);
    if (!saved) return;
    sessionStorage.removeItem(key);
    try {
      const parsed = JSON.parse(saved) as DescricaoCargo & {
        __import?: { fileName?: string; sheetName?: string; mappedFields?: number };
      };
      const { __import, ...draft } = parsed;
      setImportedDraft(draft);
      setImportNotice(
        `Importado de ${__import?.fileName ?? "planilha"} (aba ${__import?.sheetName ?? "DC"}). Confira todos os campos antes de criar.`,
      );
    } catch {
      toast.error("Não foi possível recuperar os dados importados.");
    }
  }, [positionId, projectId]);

  const initial = useMemo<DescricaoCargo>(
    () =>
      importedDraft ?? {
        ...emptyDC(),
        organization_position_id: linkedPosition?.id ?? null,
        cargo: linkedPosition?.nome ?? "",
        superior_imediato: linkedParentName,
      },
    [importedDraft, linkedParentName, linkedPosition?.id, linkedPosition?.nome],
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
        <>
          {importNotice && (
            <div className="mb-5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
              {importNotice}
            </div>
          )}
          <DCForm
            key={importedDraft ? `import:${positionId}` : `new:${positionId ?? ""}`}
            projectId={projectId}
            initial={initial}
            onSubmit={onSubmit}
            submitLabel="Criar descricao"
          />
        </>
      )}
    </main>
  );
}
