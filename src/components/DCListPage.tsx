import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  FileText,
  ArrowRight,
  ArrowLeft,
  Check,
  Trash2,
  Users,
  Clock,
  GitFork,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { logAction } from "@/lib/history";
import { withTimeout } from "@/lib/auth-safe";

type Stage = "em_criacao" | "em_aprovacao" | "concluido";
type Row = {
  id: string;
  cargo: string;
  departamento: string | null;
  unidade_negocio: string | null;
  created_by: string;
  created_at: string;
  etapa: Stage;
  pending_comment_count: number;
};
type Area = { id: string; nome: string; cor: string | null; parent_id: string | null };
type Profile = { id: string; nome: string };

const STAGES: { key: Stage; label: string; icon: React.ReactNode }[] = [
  { key: "em_criacao", label: "Em Criação", icon: <Clock className="h-4 w-4 text-blue-500" /> },
  {
    key: "em_aprovacao",
    label: "Em Aprovação",
    icon: <Users className="h-4 w-4 text-yellow-500" />,
  },
  { key: "concluido", label: "Concluídos", icon: <Check className="h-4 w-4 text-green-500" /> },
];

const stageOrder = (s: Stage): number => STAGES.findIndex((x) => x.key === s);

export function DCListPage({ projectId }: { projectId: string }) {
  const { user, isAdmin } = useCurrentUser();
  const [rows, setRows] = useState<Row[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [projectRole, setProjectRole] = useState<string | null>(null);
  const [isResponsavel, setIsResponsavel] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: dcs, error }, { data: ars }, { data: profs }, { data: proj }] =
        await Promise.all([
          withTimeout(
            supabase
              .from("descricoes_cargo")
              .select("id,cargo,departamento,unidade_negocio,created_by,created_at,etapa")
              .eq("project_id", projectId)
              .order("created_at", { ascending: false }),
            10_000,
            "Não foi possível carregar descrições.",
          ),
          supabase
            .from("project_areas")
            .select("id,nome,cor,parent_id")
            .eq("project_id", projectId),
          supabase.from("profiles").select("id,nome"),
          supabase.from("projects").select("responsavel_id").eq("id", projectId).maybeSingle(),
        ]);
      if (error) throw error;
      const dcRows = ((dcs ?? []) as Omit<Row, "pending_comment_count">[]).map((row) => ({
        ...row,
        pending_comment_count: 0,
      }));
      if (dcRows.length > 0) {
        const { data: pendingComments } = await supabase
          .from("field_comments")
          .select("job_description_id")
          .in(
            "job_description_id",
            dcRows.map((row) => row.id),
          )
          .eq("decision", "pending");
        const pendingByDc = new Map<string, number>();
        (pendingComments ?? []).forEach((comment) => {
          pendingByDc.set(
            comment.job_description_id,
            (pendingByDc.get(comment.job_description_id) ?? 0) + 1,
          );
        });
        dcRows.forEach((row) => {
          row.pending_comment_count = pendingByDc.get(row.id) ?? 0;
        });
      }
      setRows(dcRows);
      setAreas((ars ?? []) as Area[]);
      setProfiles((profs ?? []) as Profile[]);
      if (user) setIsResponsavel(proj?.responsavel_id === user.id);
      if (user) {
        const { data: mem } = await supabase
          .from("project_members")
          .select("role")
          .eq("project_id", projectId)
          .eq("user_id", user.id)
          .maybeSingle();
        setProjectRole(mem?.role ?? null);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [projectId, user?.id]);

  const areaById = useMemo(() => new Map(areas.map((a) => [a.id, a])), [areas]);
  const profileById = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);

  const isLider =
    projectRole === "lider_estrategico" ||
    projectRole === "lider_tatico" ||
    projectRole === "lider_operacional" ||
    projectRole === "lider_superior" ||
    projectRole === "lider_setor";
  const canDecideApproval = isAdmin || projectRole === "gp" || projectRole === "admin" || isLider;
  const hasFullControl =
    isAdmin || isResponsavel || projectRole === "gp" || projectRole === "admin";
  const isOnlyLider = isLider && !hasFullControl;
  const visibleStages = isOnlyLider
    ? STAGES.filter((s) => s.key === "em_aprovacao" || s.key === "concluido")
    : STAGES;

  const moveStage = async (row: Row, target: Stage) => {
    const { error } = await supabase
      .from("descricoes_cargo")
      .update({ etapa: target })
      .eq("id", row.id);
    if (error) return toast.error(error.message);
    await logAction({
      projectId,
      acao: "dc_etapa",
      entidade: "descricao_cargo",
      entidadeId: row.id,
      detalhes: { de: row.etapa, para: target },
    });
    void load();
  };

  const remove = async (row: Row) => {
    if (!confirm(`Excluir "${row.cargo}"?`)) return;
    const { error } = await supabase.from("descricoes_cargo").delete().eq("id", row.id);
    if (error) return toast.error(error.message);
    await logAction({
      projectId,
      acao: "dc_excluida",
      entidade: "descricao_cargo",
      entidadeId: row.id,
      detalhes: { cargo: row.cargo },
    });
    void load();
  };

  const getSetorInfo = (row: Row) => {
    const setor = row.departamento ? areaById.get(row.departamento) : null;
    if (!setor) return null;
    const parent = setor.parent_id ? areaById.get(setor.parent_id) : null;
    return {
      nome: setor.nome,
      cor: setor.cor ?? parent?.cor ?? "#042558",
    };
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#042558]/5 via-white to-[#042558]/5 px-6 py-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 rounded-2xl border border-[#042558]/10 bg-white/80 p-6 shadow-sm backdrop-blur-sm md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className=""></div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-[#042558]">
                  Aprovações e acompanhamento
                </h1>
                <p className="text-sm text-[#042558]/60">
                  Acompanhe as descrições criadas pelo organograma e avance as etapas de revisão.
                </p>
              </div>
            </div>
          </div>
          <Link
            to="/projetos/$projectId/organograma"
            params={{ projectId }}
            className="group inline-flex items-center gap-2 rounded-lg border border-[#042558]/20 bg-white px-4 py-2.5 text-sm font-medium text-[#042558] transition-all hover:bg-[#042558]/5 focus:outline-none focus:ring-2 focus:ring-[#042558] focus:ring-offset-2"
          >
            <GitFork className="h-4 w-4" />
            Ir para o organograma
          </Link>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex h-64 items-center justify-center rounded-2xl border border-[#042558]/10 bg-white/60">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#042558] border-t-transparent" />
              <p className="text-sm text-[#042558]/60">Carregando descrições...</p>
            </div>
          </div>
        ) : (
          <div
            className={`grid gap-6 ${visibleStages.length === 1 ? "md:grid-cols-1" : "md:grid-cols-3"}`}
          >
            {visibleStages.map((stage) => {
              const items = rows.filter((r) => r.etapa === stage.key);
              return (
                <section
                  key={stage.key}
                  className="flex flex-col rounded-2xl border border-[#042558]/10 bg-white/60 p-4 shadow-sm backdrop-blur-sm transition-all hover:shadow-lg"
                >
                  <header className="mb-4 flex items-center justify-between border-b border-[#042558]/10 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="rounded-md bg-[#042558]/10 p-1.5 text-[#042558]">
                        {stage.icon}
                      </div>
                      <h2 className="text-sm font-semibold uppercase tracking-wider text-[#042558]">
                        {stage.label}
                      </h2>
                    </div>
                    <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-[#042558]/10 px-2 text-xs font-medium text-[#042558]">
                      {items.length}
                    </span>
                  </header>

                  {items.length === 0 ? (
                    <div className="flex flex-1 flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#042558]/20 p-8">
                      <FileText className="mb-2 h-8 w-8 text-[#042558]/30" />
                      <p className="text-xs text-[#042558]/40">Nenhuma descrição</p>
                    </div>
                  ) : (
                    <div className="flex-1 space-y-3">
                      {items.map((row) => {
                        const responsavel = profileById.get(row.created_by);
                        const stageIdx = stageOrder(row.etapa);
                        const canMoveToApproval =
                          row.etapa === "em_criacao" &&
                          (projectRole === "gp" ||
                            projectRole === "admin" ||
                            isAdmin ||
                            isResponsavel);
                        const canApprove =
                          row.etapa === "em_aprovacao" && canDecideApproval && !isOnlyLider;
                        const setorInfo = getSetorInfo(row);
                        const hasPendingComments = row.pending_comment_count > 0;

                        return (
                          <article
                            key={row.id}
                            className={`group relative overflow-hidden rounded-xl border p-4 shadow-sm transition-all hover:shadow-md ${
                              hasPendingComments
                                ? "border-amber-300 bg-amber-50/80 ring-1 ring-amber-200 hover:border-amber-400"
                                : "border-[#042558]/10 bg-white hover:border-[#042558]/30"
                            }`}
                          >
                            {hasPendingComments && (
                              <span
                                className="absolute right-3 top-3 inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-amber-500 px-1.5 text-xs font-bold text-white shadow-sm"
                                title={`${row.pending_comment_count} comentario(s) pendente(s)`}
                              >
                                {row.pending_comment_count}
                              </span>
                            )}
                            <Link
                              to="/projetos/$projectId/descricao-cargo/$dcId"
                              params={{ projectId, dcId: row.id }}
                              className="block"
                            >
                              <h3 className={`text-base font-semibold leading-tight text-[#042558] transition-colors group-hover:text-[#042558]/80 ${hasPendingComments ? "pr-8" : ""}`}>
                                {row.cargo || "(sem cargo)"}
                              </h3>
                            </Link>

                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span className="text-xs font-medium text-[#042558]/60 uppercase">
                                {row.cargo?.toUpperCase() || "SEM CARGO"},
                              </span>
                              <span className="text-xs text-[#042558]/40">
                                {new Date(row.created_at).toLocaleDateString("pt-BR")}
                              </span>
                            </div>

                            {responsavel && (
                              <p className="mt-1 text-xs text-[#042558]/40">
                                por{" "}
                                <span className="font-medium text-[#042558]/70">
                                  {responsavel.nome}
                                </span>
                              </p>
                            )}

                            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#042558]/10 pt-3">
                              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                                {hasPendingComments && (
                                  <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                                    <MessageSquare className="h-3 w-3" />
                                    Revisar
                                  </span>
                                )}
                                {setorInfo && (
                                  <div className="flex min-w-0 items-center gap-1.5">
                                    <span
                                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                                      style={{ background: setorInfo.cor }}
                                    />
                                    <span className="truncate text-[10px] font-medium text-[#042558]/60">
                                      {setorInfo.nome}
                                    </span>
                                  </div>
                                )}
                              </div>
                              <div className="ml-auto flex flex-wrap items-center justify-end gap-1">
                                {hasFullControl && stageIdx > 0 && (
                                  <button
                                    onClick={() => moveStage(row, STAGES[stageIdx - 1].key)}
                                    className="rounded-md p-1.5 text-[#042558]/40 transition-colors hover:bg-[#042558]/10 hover:text-[#042558]"
                                    title="Etapa anterior"
                                  >
                                    <ArrowLeft className="h-3.5 w-3.5" />
                                  </button>
                                )}
                                {canMoveToApproval && (
                                  <button
                                    onClick={() => moveStage(row, "em_aprovacao")}
                                    className="rounded-md p-1.5 text-[#042558]/40 transition-colors hover:bg-[#042558]/10 hover:text-[#042558]"
                                    title="Enviar para aprovação"
                                  >
                                    <ArrowRight className="h-3.5 w-3.5" />
                                  </button>
                                )}
                                {hasFullControl && (
                                  <button
                                    onClick={() => remove(row)}
                                    className="rounded-md p-1.5 text-[#042558]/40 transition-colors hover:bg-red-50 hover:text-red-600"
                                    title="Excluir"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                                {canApprove && (
                                  <button
                                    onClick={() => moveStage(row, "concluido")}
                                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#042558] px-3 py-1.5 text-xs font-medium text-white shadow-lg shadow-[#042558]/20 transition-all hover:bg-[#042558]/90 hover:shadow-xl"
                                  >
                                    <Check className="h-3.5 w-3.5" /> Aprovar
                                  </button>
                                )}
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
