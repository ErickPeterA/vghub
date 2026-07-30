import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { History as HistoryIcon, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DCForm } from "@/components/DCForm";
import { emptyDC, type DescricaoCargo } from "@/lib/dc-types";
import { logAction } from "@/lib/history";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/projetos/$projectId/descricao-cargo/$dcId")({
  component: EditDC,
});

type DCRow = DescricaoCargo & { etapa?: "em_criacao" | "em_aprovacao" | "concluido" };
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
  const { data: position } = await supabase
    .from("project_positions")
    .select("id,nome,parent_id")
    .eq("project_id", projectId)
    .eq("id", positionId)
    .maybeSingle();

  const orgPosition = position as OrgPositionRow | null;
  if (!orgPosition?.parent_id) return "";

  const { data: parent } = await supabase
    .from("project_positions")
    .select("nome")
    .eq("project_id", projectId)
    .eq("id", orgPosition.parent_id)
    .maybeSingle();

  return parent?.nome ?? "";
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

  const loadVersions = async () => {
    const { data } = await supabase
      .from("job_description_versions")
      .select("id,version_number,created_at,snapshot,source_comment_version_id")
      .eq("job_description_id", dcId)
      .order("version_number", { ascending: true });
    setVersions((data ?? []) as VersionRow[]);
  };

  useEffect(() => {
    void supabase
      .from("descricoes_cargo")
      .select("*")
      .eq("id", dcId)
      .maybeSingle()
      .then(async ({ data, error }) => {
        if (error || !data) {
          toast.error("Não encontrado");
          navigate({ to: "/projetos/$projectId/descricao-cargo", params: { projectId } });
          return;
        }
        const next = fromSnapshot(data) as DCRow;
        if (next.organization_position_id) {
          next.superior_imediato = await getOrgSuperiorName(
            projectId,
            next.organization_position_id,
          );
        }
        setCurrent({ ...next, etapa: (data.etapa as DCRow["etapa"]) ?? "em_criacao" });
      });
    void loadVersions();
    void supabase
      .from("projects")
      .select("responsavel_id")
      .eq("id", projectId)
      .maybeSingle()
      .then(({ data }) => {
        if (user) setIsResponsavel(data?.responsavel_id === user.id);
      });
    if (user) {
      void supabase
        .from("project_members")
        .select("role")
        .eq("project_id", projectId)
        .eq("user_id", user.id)
        .maybeSingle()
        .then(({ data }) => {
          setProjectRole(data?.role ?? null);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dcId, projectId, user?.id]);

  const isLider = projectRole !== null && LIDER_ROLES.has(projectRole);
  const canApproveDescription =
    isAdmin || projectRole === "gp" || projectRole === "admin" || isLider;
  const canDecideComment = isAdmin || projectRole === "gp" || projectRole === "admin";
  const hasFullControl = canDecideComment || isResponsavel;
  const canEditDraft = isLider && !hasFullControl && current?.etapa === "em_criacao";
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
    const { error } = await supabase
      .from("descricoes_cargo")
      .update({
        ...payload,
        data_versao: validDateOrNull(payload.data_versao),
        data_revisao: validDateOrNull(payload.data_revisao),
      })
      .eq("id", dcId);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logAction({
      projectId,
      acao: "dc_atualizada",
      entidade: "descricao_cargo",
      entidadeId: dcId,
      detalhes: { cargo: dc.cargo },
    });
    toast.success("Atualizado");
  };

  const finalizarRevisao = async () => {
    if (!currentVersion) return;
    setFinalizando(true);
    try {
      const { count } = await supabase
        .from("field_comments")
        .select("id", { count: "exact", head: true })
        .eq("job_description_id", dcId)
        .eq("version_id", currentVersion.id);
      const hasComments = (count ?? 0) > 0;
      const target = hasComments ? "em_criacao" : "concluido";
      const { error } = await supabase
        .from("descricoes_cargo")
        .update({ etapa: target })
        .eq("id", dcId);
      if (error) throw error;
      await logAction({
        projectId,
        acao: "dc_revisao_finalizada",
        entidade: "descricao_cargo",
        entidadeId: dcId,
        detalhes: { comentarios: count ?? 0, para: target },
      });
      toast.success(hasComments ? "Item retornou para Em Criação" : "Revisão concluída");
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
      const { error } = await supabase
        .from("descricoes_cargo")
        .update({ etapa: "concluido" })
        .eq("id", dcId);
      if (error) throw error;
      await logAction({
        projectId,
        acao: "dc_aprovada",
        entidade: "descricao_cargo",
        entidadeId: dcId,
        detalhes: { para: "concluido" },
      });
      toast.success("Descrição aprovada");
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
        commentTarget={{
          dcId,
          versionId: versionIdForComments,
          canAddComment: (isLider || canDecideComment) && !viewingVersionId,
          canDecideComment: canDecideComment,
          onCommentDecision: loadVersions,
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
