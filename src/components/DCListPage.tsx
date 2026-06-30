import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, FileText, ArrowRight, ArrowLeft, Check, Trash2 } from "lucide-react";
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
};
type Area = { id: string; nome: string; cor: string | null; parent_id: string | null };
type Profile = { id: string; nome: string };

const STAGES: { key: Stage; label: string }[] = [
  { key: "em_criacao", label: "Em Criação" },
  { key: "em_aprovacao", label: "Em Aprovação" },
  { key: "concluido", label: "Concluídos" },
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
      const [{ data: dcs, error }, { data: ars }, { data: profs }, { data: proj }] = await Promise.all([
        withTimeout(
          supabase
            .from("descricoes_cargo")
            .select("id,cargo,departamento,unidade_negocio,created_by,created_at,etapa")
            .eq("project_id", projectId)
            .order("created_at", { ascending: false }),
          10_000,
          "Não foi possível carregar descrições.",
        ),
        supabase.from("project_areas").select("id,nome,cor,parent_id").eq("project_id", projectId),
        supabase.from("profiles").select("id,nome"),
        supabase.from("projects").select("responsavel_id").eq("id", projectId).maybeSingle(),
      ]);
      if (error) throw error;
      setRows((dcs as Row[]) ?? []);
      setAreas((ars ?? []) as Area[]);
      setProfiles((profs ?? []) as Profile[]);
      if (user) setIsResponsavel(proj?.responsavel_id === user.id);
      if (user) {
        const { data: mem } = await supabase
          .from("project_members").select("role").eq("project_id", projectId).eq("user_id", user.id).maybeSingle();
        setProjectRole(mem?.role ?? null);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar");
    } finally { setLoading(false); }
  };
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [projectId, user?.id]);

  const areaById = useMemo(() => new Map(areas.map((a) => [a.id, a])), [areas]);
  const profileById = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);

  const hasFullControl = isAdmin || isResponsavel || projectRole === "gp" || projectRole === "admin";
  const isLider = projectRole === "lider_superior" || projectRole === "lider_setor";
  const isUsuarioComum = projectRole === "usuario_comum";

  const moveStage = async (row: Row, target: Stage) => {
    const { error } = await supabase.from("descricoes_cargo").update({ etapa: target }).eq("id", row.id);
    if (error) return toast.error(error.message);
    await logAction({ projectId, acao: "dc_etapa", entidade: "descricao_cargo", entidadeId: row.id, detalhes: { de: row.etapa, para: target } });
    void load();
  };

  const remove = async (row: Row) => {
    if (!confirm(`Excluir "${row.cargo}"?`)) return;
    const { error } = await supabase.from("descricoes_cargo").delete().eq("id", row.id);
    if (error) return toast.error(error.message);
    await logAction({ projectId, acao: "dc_excluida", entidade: "descricao_cargo", entidadeId: row.id, detalhes: { cargo: row.cargo } });
    void load();
  };

  const renderSetorBadge = (row: Row) => {
    const setor = row.departamento ? areaById.get(row.departamento) : null;
    if (!setor) return null;
    const parent = setor.parent_id ? areaById.get(setor.parent_id) : null;
    const color = setor.cor ?? parent?.cor ?? "#6366F1";
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: `${color}22`, color }}>
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
        {setor.nome}
      </span>
    );
  };

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Cargos do projeto</p>
          <h1 className="mt-2 font-display text-4xl">Descrição de Cargo</h1>
        </div>
        <Link to="/projetos/$projectId/descricao-cargo/novo" params={{ projectId }} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground">
          <Plus className="h-4 w-4" /> Criar Descrição
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {STAGES.map((stage) => {
            const items = rows.filter((r) => r.etapa === stage.key);
            return (
              <section key={stage.key} className="rounded-xl border border-border bg-card/40 p-3">
                <header className="mb-3 flex items-center justify-between border-b border-border pb-2">
                  <h2 className="text-sm font-semibold uppercase tracking-wider">{stage.label}</h2>
                  <span className="text-xs text-muted-foreground">{items.length}</span>
                </header>
                {items.length === 0 ? (
                  <div className="rounded-md border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                    <FileText className="mx-auto mb-1 h-5 w-5 opacity-60" />
                    Nenhum item
                  </div>
                ) : (
                  <div className="space-y-2">
                    {items.map((row) => {
                      const responsavel = profileById.get(row.created_by);
                      const stageIdx = stageOrder(row.etapa);
                      const isOwner = user?.id === row.created_by;
                      const canApprove =
                        row.etapa === "em_aprovacao" &&
                        (isAdmin || isResponsavel || isLider || (isUsuarioComum && isOwner));
                      return (
                        <article key={row.id} className="rounded-lg border border-border bg-card p-3 shadow-sm">
                          <Link to="/projetos/$projectId/descricao-cargo/$dcId" params={{ projectId, dcId: row.id }} className="block">
                            <h3 className="font-medium leading-tight hover:underline">{row.cargo || "(sem cargo)"}</h3>
                          </Link>
                          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                            {renderSetorBadge(row)}
                            <span>{new Date(row.created_at).toLocaleDateString("pt-BR")}</span>
                          </div>
                          {responsavel && <p className="mt-1 text-xs text-muted-foreground">por <span className="text-foreground">{responsavel.nome}</span></p>}

                          <div className="mt-3 flex items-center justify-end gap-1.5">
                            {hasFullControl && (
                              <>
                                {stageIdx > 0 && (
                                  <button onClick={() => moveStage(row, STAGES[stageIdx - 1].key)} className="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-secondary" title="Etapa anterior">
                                    <ArrowLeft className="h-3.5 w-3.5" />
                                  </button>
                                )}
                                {stageIdx < STAGES.length - 1 && (
                                  <button onClick={() => moveStage(row, STAGES[stageIdx + 1].key)} className="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-secondary" title="Próxima etapa">
                                    <ArrowRight className="h-3.5 w-3.5" />
                                  </button>
                                )}
                                <button onClick={() => remove(row)} className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Excluir">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </>
                            )}
                            {!hasFullControl && canApprove && (
                              <button onClick={() => moveStage(row, "concluido")} className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:opacity-90">
                                <Check className="h-3.5 w-3.5" /> Aprovar
                              </button>
                            )}
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
    </main>
  );
}
