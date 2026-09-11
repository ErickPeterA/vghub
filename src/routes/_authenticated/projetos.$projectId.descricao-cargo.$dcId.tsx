import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { History as HistoryIcon, ArrowLeft } from "lucide-react";
import { apiJson } from "@/lib/api";
import { DCForm } from "@/components/DCForm";
import { emptyDC, type DescricaoCargo } from "@/lib/dc-types";
import { logAction } from "@/lib/history";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/projetos/$projectId/descricao-cargo/$dcId")({
  component: EditDC,
});

type DCRow = DescricaoCargo & {
  created_by?: string;
  etapa?: "em_criacao" | "em_aprovacao" | "concluido";
};
type VersionRow = {
  id: string;
  version_number: number;
  created_at: string;
  snapshot: unknown;
  source_comment_version_id: string | null;
};
type OrgPositionRow = { id: string; nome: string; parent_id: string | null };

const LIDER_ROLES = new Set([
  "lider_estrategico",
  "lider_tatico",
  "lider_operacional",
  "lider_superior",
  "lider_setor",
]);

function validDateOrNull(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

function fromSnapshot(snapshot: unknown): DescricaoCargo {
  const base = emptyDC();
  const data = (snapshot ?? {}) as Partial<DescricaoCargo>;
  return {
    ...base,
    ...data,
    dynamic_values: (data.dynamic_values as DescricaoCargo["dynamic_values"]) ?? {},
    data_versao: data.data_versao ?? "",
    data_revisao: data.data_revisao ?? "",
  } as DescricaoCargo;
}

async function getOrgSuperiorName(projectId: string, positionId: string) {
  const { position } = await apiJson<{
    ok: boolean;
    position: { parent_nome?: string | null } | null;
  }>(`/api/projects/${projectId}/dc?mode=linked-position&positionId=${positionId}`);
  return position?.parent_nome ?? "";
}

function EditDC() {
  const { projectId, dcId } = Route.useParams();
  const navigate = useNavigate();
  const { user, isAdmin } = useCurrentUser();
  const [current, setCurrent] = useState<DCRow | null>(null);
  const [projectRole, setProjectRole] = useState<string | null>(null);
  const [isResponsavel, setIsResponsavel] = useState(false);
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [viewingVersionId, setViewingVersionId] = useState<string | null>(null);
  const [openVersions, setOpenVersions] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [focusFieldKey, setFocusFieldKey] = useState<string | null>(null);

  const loadVersions = async () => {
    const data = await apiJson<{ ok: boolean; versions: VersionRow[] }>(
      `/api/projects/${projectId}/dc/${dcId}`,
    );
    setVersions(data.versions ?? []);
  };
  const loadCurrent = async () => {
    try {
      const data = await apiJson<{
        ok: boolean;
        current: DCRow & { organization_superior_name?: string | null };
        versions: VersionRow[];
        projectRole: string | null;
        isResponsavel: boolean;
      }>(`/api/projects/${projectId}/dc/${dcId}`);
      const next = fromSnapshot(data.current) as DCRow;
      if (next.organization_position_id) {
        next.superior_imediato = data.current.organization_superior_name ?? "";
      }
      setCurrent({ ...next, etapa: (data.current.etapa as DCRow["etapa"]) ?? "em_criacao" });
      setVersions(data.versions ?? []);
      setProjectRole(data.projectRole ?? null);
      setIsResponsavel(data.isResponsavel ?? false);
    } catch {
      toast.error("Nao encontrado");
      navigate({ to: "/projetos/$projectId/descricao-cargo", params: { projectId } });
    }
  };
  useEffect(() => {
    void loadCurrent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dcId, projectId, user?.id]);

  const isLider = projectRole !== null && LIDER_ROLES.has(projectRole);
  const canApproveDescription =
    isAdmin || projectRole === "gp" || projectRole === "admin" || isLider;
  const canDecideComment = isAdmin || projectRole === "gp" || projectRole === "admin";
  const hasFullControl = canDecideComment || isResponsavel;
  const canEditDraft =
    isLider && !hasFullControl && current?.etapa === "em_criacao" && current.created_by === user?.id;
  const readOnly = (!canEditDraft && isLider && !hasFullControl) || viewingVersionId !== null;

  const currentVersion = versions.length > 0 ? versions[versions.length - 1] : null;
  const viewingVersion = viewingVersionId
    ? (versions.find((v) => v.id === viewingVersionId) ?? null)
    : null;
  const displayedInitial = useMemo<DescricaoCargo | null>(() => {
    if (viewingVersion) return fromSnapshot(viewingVersion.snapshot);
    return current;
  }, [viewingVersion, current]);

  const versionIdForComments = viewingVersion?.id ?? currentVersion?.id ?? null;

  const handleCommentChange = async () => {
    await Promise.all([loadCurrent(), loadVersions()]);
  };

  const handleFieldDecision = async ({ fieldKey }: { fieldKey: string }) => {
    setViewingVersionId(null);
    setFocusFieldKey(null);
    window.setTimeout(() => setFocusFieldKey(fieldKey), 0);
  };

  const onSubmit = async (dc: DescricaoCargo) => {
    if (readOnly) return;
    const { id: _omit, ...payload } = dc;
    void _omit;
    if (current?.organization_position_id) {
      payload.superior_imediato = await getOrgSuperiorName(
        projectId,
        current.organization_position_id,
      );
      payload.organization_position_id = current.organization_position_id;
    }
    try {
      const { versionId } = await apiJson<{ ok: boolean; versionId: string | null }>(
        `/api/projects/${projectId}/dc/${dcId}`,
        {
          method: "PATCH",
          body: {
            action: "update",
            payload: {
              ...payload,
              data_versao: validDateOrNull(payload.data_versao),
              data_revisao: validDateOrNull(payload.data_revisao),
              organization_position_id: payload.organization_position_id ?? null,
            },
            currentVersionId: currentVersion?.id ?? null,
          },
        },
      );
      await logAction({
        projectId,
        acao: "dc_atualizada",
        entidade: "descricao_cargo",
        entidadeId: dcId,
        detalhes: { cargo: dc.cargo },
      });
      if (versionId) {
        await loadVersions();
        toast.success("Nova versao gerada com os comentarios resolvidos");
        return;
      }
      toast.success("Atualizado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao atualizar");
    }
  };
  const finalizarRevisao = async () => {
    if (!currentVersion) return;
    setFinalizando(true);
    try {
      const { comments, target } = await apiJson<{ ok: boolean; comments: number; target: DCRow["etapa"] }>(
        `/api/projects/${projectId}/dc/${dcId}`,
        { method: "PATCH", body: { action: "finalize_review", versionId: currentVersion.id } },
      );
      await logAction({
        projectId,
        acao: "dc_revisao_finalizada",
        entidade: "descricao_cargo",
        entidadeId: dcId,
        detalhes: { comentarios: comments, para: target },
      });
      toast.success(comments > 0 ? "Item retornou para Em Criacao" : "Revisao concluida");
      navigate({ to: "/projetos/$projectId/descricao-cargo", params: { projectId } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao finalizar");
    } finally {
      setFinalizando(false);
    }
  };
  const approveDescription = async () => {
    setFinalizando(true);
    try {
      await apiJson(`/api/projects/${projectId}/dc/${dcId}`, {
        method: "PATCH",
        body: { action: "stage", etapa: "concluido" },
      });
      await logAction({
        projectId,
        acao: "dc_aprovada",
        entidade: "descricao_cargo",
        entidadeId: dcId,
        detalhes: { para: "concluido" },
      });
      toast.success("Descricao aprovada");
      navigate({ to: "/projetos/$projectId/descricao-cargo", params: { projectId } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao aprovar");
    } finally {
      setFinalizando(false);
    }
  };
  if (!displayedInitial)
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Carregando...
      </div>
    );

  const showApprovalActions =
    canApproveDescription && current?.etapa === "em_aprovacao" && !viewingVersionId;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-4xl">
          {readOnly ? "Descrição (leitura)" : "Editar descrição"}
        </h1>
        <button
          type="button"
          onClick={() => {
            void loadVersions();
            setOpenVersions(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <HistoryIcon className="h-4 w-4" /> Versões ({versions.length})
        </button>
      </div>

      {viewingVersion && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          <span>
            Visualizando versão {viewingVersion.version_number} de {versions.length}
          </span>
          <button
            type="button"
            onClick={() => setViewingVersionId(null)}
            className="inline-flex items-center gap-1.5 rounded-md bg-amber-100 px-3 py-1 text-xs font-medium hover:bg-amber-200"
          >
            <ArrowLeft className="h-3 w-3" /> Voltar à versão atual
          </button>
        </div>
      )}

      <DCForm
        projectId={projectId}
        initial={displayedInitial}
        onSubmit={onSubmit}
        submitLabel="Salvar alterações"
        readOnly={readOnly}
        focusFieldKey={focusFieldKey}
        commentTarget={{
          dcId,
          versionId: versionIdForComments,
          canAddComment: (isLider || canDecideComment) && !viewingVersionId,
          canDecideComment: canDecideComment,
          onCommentDecision: handleCommentChange,
          onFieldDecision: handleFieldDecision,
        }}
        footerExtra={
          showApprovalActions ? (
            <button
              type="button"
              onClick={approveDescription}
              disabled={finalizando}
              className="rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
            >
              {finalizando ? "Aprovando..." : "Aprovar"}
            </button>
          ) : null
        }
      />

      <Dialog open={openVersions} onOpenChange={setOpenVersions}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Versões</DialogTitle>
          </DialogHeader>
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {versions.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma versão registrada.</p>
            )}
            {versions
              .slice()
              .reverse()
              .map((v) => {
                const isCurrent = v.id === currentVersion?.id;
                const isViewing = v.id === viewingVersionId;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => {
                      setViewingVersionId(isCurrent ? null : v.id);
                      setOpenVersions(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition ${isViewing ? "border-amber-400 bg-amber-50" : "border-border hover:bg-secondary"}`}
                  >
                    <span className="font-medium">
                      Versão {v.version_number}
                      {isCurrent ? " (atual)" : ""}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(v.created_at).toLocaleString("pt-BR")}
                    </span>
                  </button>
                );
              })}
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}

