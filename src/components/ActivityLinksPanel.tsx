import { useCallback, useEffect, useState } from "react";
import type { ComponentType } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  Clock3,
  Copy,
  Download,
  Eye,
  Link2,
  Plus,
  RotateCcw,
  Send,
  Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { normalizeActivityFields, type ActivityField } from "./ActivityConfigManager";
import { useProjectAreas, type ProjectArea } from "./DynamicFields";

type ActivityStage = "creating" | "sent" | "answered";

type LinkRow = {
  id: string;
  token: string;
  status: "pending" | "answered" | "expired" | "cancelled";
  expires_at: string;
  answered_at: string | null;
  reviewed_at: string | null;
  draft_saved_at: string | null;
  header_answers: Record<string, string> | null;
  label: string | null;
  created_at: string;
};

type ResponseRow = {
  id: string;
  link_id: string;
  project_id?: string;
  header_answers: Record<string, string>;
  question_answers: QuestionAnswerGroup | QuestionAnswerGroup[];
  submitted_at: string;
};

type QuestionAnswerGroup = Record<string, string>;

const STATUS_LABEL: Record<LinkRow["status"], string> = {
  pending: "Pendente",
  answered: "Respondido",
  expired: "Expirado",
  cancelled: "Cancelado",
};

const STATUS_COLOR: Record<LinkRow["status"], string> = {
  pending: "bg-amber-100 text-amber-800",
  answered: "bg-emerald-100 text-emerald-800",
  expired: "bg-slate-100 text-slate-600",
  cancelled: "bg-red-100 text-red-800",
};

const ACTIVITY_STAGES: Array<{
  key: ActivityStage;
  label: string;
  empty: string;
  icon: ComponentType<{ className?: string }>;
  iconClass: string;
}> = [
  {
    key: "creating",
    label: "Em criação",
    empty: "Nenhuma atividade em criação",
    icon: Clock3,
    iconClass: "text-blue-500",
  },
  {
    key: "sent",
    label: "Link enviado",
    empty: "Nenhum link enviado",
    icon: Send,
    iconClass: "text-amber-500",
  },
  {
    key: "answered",
    label: "Respondido",
    empty: "Nenhuma resposta recebida",
    icon: CheckCircle2,
    iconClass: "text-emerald-500",
  },
];

const ACTIVITY_LINK_DAYS = 7;
const ACTIVITY_REOPEN_DAYS = 3;

type EmployeeRow = {
  id: string;
  nome: string;
  position_id: string;
  area_id: string | null;
  sector_id: string | null;
};

type PositionRow = { id: string; nome: string };

export function ActivityLinksPanel({
  projectId,
  onUnreviewedChange,
}: {
  projectId: string;
  onUnreviewedChange?: (n: number) => void;
}) {
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [configId, setConfigId] = useState<string | null>(null);
  const [configFields, setConfigFields] = useState<{
    header: ActivityField[];
    questions: ActivityField[];
  } | null>(null);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [generating, setGenerating] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [openResp, setOpenResp] = useState<{ link: LinkRow; response: ResponseRow | null } | null>(
    null,
  );
  const areas = useProjectAreas(projectId);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: cfg }, { data: ls }, { data: emps }, { data: pos }] = await Promise.all([
      supabase
        .from("activity_configs")
        .select("id,header_schema,questions_schema")
        .eq("project_id", projectId)
        .maybeSingle(),
      supabase
        .from("activity_links")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false }),
      supabase
        .from("project_employees")
        .select("id,nome,position_id,area_id,sector_id")
        .eq("project_id", projectId)
        .order("nome"),
      supabase.from("project_positions").select("id,nome").eq("project_id", projectId),
    ]);
    if (cfg) {
      setConfigId(cfg.id);
      setConfigFields({
        header: normalizeActivityFields((cfg.header_schema as ActivityField[]) ?? []),
        questions: normalizeActivityFields((cfg.questions_schema as ActivityField[]) ?? []),
      });
    } else {
      setConfigId(null);
      setConfigFields(null);
    }

    setEmployees((emps ?? []) as EmployeeRow[]);
    setPositions((pos ?? []) as PositionRow[]);

    const now = new Date().toISOString();
    const rows = (ls ?? []) as LinkRow[];
    const toExpire = rows
      .filter((l) => l.status === "pending" && l.expires_at < now)
      .map((l) => l.id);
    if (toExpire.length) {
      await supabase.from("activity_links").update({ status: "expired" }).in("id", toExpire);
      rows.forEach((l) => {
        if (toExpire.includes(l.id)) l.status = "expired";
      });
    }
    setLinks(rows);
    onUnreviewedChange?.(rows.filter((l) => l.status === "answered" && !l.reviewed_at).length);
    setLoading(false);
  }, [projectId, onUnreviewedChange]);

  useEffect(() => {
    void load();
  }, [load]);

  const gpHeaderFields =
    configFields?.header.filter(
      (field) => (field.active ?? true) && (field.filledBy ?? "collaborator") === "gp",
    ) ?? [];
  const areaField = gpHeaderFields.find((field) => field.dataSource === "areas");
  const setorField = gpHeaderFields.find((field) => field.dataSource === "setores");

  const areaById = new Map(areas.map((a) => [a.id, a]));
  const positionById = new Map(positions.map((p) => [p.id, p]));

  const employeeIdOf = (link: LinkRow) =>
    ((link.header_answers as Record<string, string> | null)?.__employee_id as string | undefined) ??
    null;

  const linkByEmployee = new Map<string, LinkRow>();
  links
    .filter((l) => l.status !== "cancelled")
    .forEach((l) => {
      const eid = employeeIdOf(l);
      if (eid && !linkByEmployee.has(eid)) linkByEmployee.set(eid, l);
    });

  const stageFor = (link: LinkRow): ActivityStage => {
    if (link.status === "answered") return "answered";
    if (link.status === "pending" && link.draft_saved_at) return "creating";
    return "sent";
  };

  const gerar = async (employee: EmployeeRow) => {
    if (!configId) return toast.error("Configure o formulário primeiro.");

    const areaName = employee.area_id ? (areaById.get(employee.area_id)?.nome ?? "") : "";
    const setorName = employee.sector_id ? (areaById.get(employee.sector_id)?.nome ?? "") : "";
    const cargoName = positionById.get(employee.position_id)?.nome ?? "";

    const header: Record<string, string> = { __employee_id: employee.id };
    if (areaField && areaName) header[areaField.id] = employee.area_id ?? areaName;
    if (setorField && setorName) header[setorField.id] = employee.sector_id ?? setorName;
    gpHeaderFields.forEach((field) => {
      const key = `${field.id} ${field.label}`
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
      if (field.dataSource === "areas" || field.dataSource === "setores") return;
      if (key.includes("cargo") && cargoName) header[field.id] = cargoName;
      else if (key.includes("nome") || key.includes("colaborador") || key.includes("funcionario"))
        header[field.id] = employee.nome;
    });

    setGenerating(employee.id);
    const expires_at = new Date(
      Date.now() + ACTIVITY_LINK_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("activity_links").insert({
      project_id: projectId,
      config_id: configId,
      expires_at,
      header_answers: header,
      label: employee.nome,
      created_by: userData.user?.id ?? null,
    });
    setGenerating(null);
    if (error) return toast.error(error.message);
    toast.success(`Link gerado para ${employee.nome}`);
    void load();
  };

  const copiar = async (token: string) => {
    const url = `${window.location.origin}/atividades/preencher/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const cancelar = async (l: LinkRow) => {
    if (!confirm("Cancelar este link?")) return;
    const { error } = await supabase
      .from("activity_links")
      .update({ status: "cancelled" })
      .eq("id", l.id);
    if (error) return toast.error(error.message);
    void load();
  };

  const reativar = async (l: LinkRow) => {
    const expires_at = new Date(
      Date.now() + ACTIVITY_REOPEN_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();
    const { error } = await supabase
      .from("activity_links")
      .update({ status: "pending", expires_at })
      .eq("id", l.id);
    if (error) return toast.error(error.message);
    toast.success("Link reaberto por 3 dias");
    void load();
  };

  const abrirResposta = async (l: LinkRow) => {
    const { data } = await supabase
      .from("activity_responses")
      .select("*")
      .eq("link_id", l.id)
      .maybeSingle();
    setOpenResp({ link: l, response: (data as ResponseRow | null) ?? null });
    if (l.status === "answered" && !l.reviewed_at) {
      await supabase
        .from("activity_links")
        .update({ reviewed_at: new Date().toISOString() })
        .eq("id", l.id);
      void load();
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#042558]/10 bg-white/60 p-5 shadow-sm">
        <div className="mb-3 flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-[#042558]">
            Funcionários do projeto ({employees.length})
          </h3>
          <span className="text-xs text-[#042558]/50">Validade do link: 7 dias</span>
        </div>
        {!configId && (
          <p className="mb-2 text-xs text-amber-700">Salve a configuração antes de gerar links.</p>
        )}

        {loading ? (
          <div className="py-6 text-center text-sm text-[#042558]/60">Carregando...</div>
        ) : employees.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-[#042558]/15 p-6 text-center text-sm text-[#042558]/40">
            Nenhum funcionário cadastrado. Cadastre-os na aba Funcionários.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[#042558]/10">
            <table className="w-full text-sm">
              <thead className="bg-[#042558]/5 text-left text-xs uppercase tracking-wider text-[#042558]/60">
                <tr>
                  <th className="px-3 py-2">Nome</th>
                  <th className="px-3 py-2">Área</th>
                  <th className="px-3 py-2">Setor</th>
                  <th className="px-3 py-2">Cargo</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#042558]/10 bg-white/60">
                {employees.map((emp) => {
                  const link = linkByEmployee.get(emp.id) ?? null;
                  const status = link ? STATUS_LABEL[link.status] : "Sem link";
                  const color = link ? STATUS_COLOR[link.status] : "bg-slate-100 text-slate-600";
                  return (
                    <tr key={emp.id} className="text-[#042558]">
                      <td className="px-3 py-2 font-medium">{emp.nome}</td>
                      <td className="px-3 py-2 text-[#042558]/70">
                        {(emp.area_id && areaById.get(emp.area_id)?.nome) || "—"}
                      </td>
                      <td className="px-3 py-2 text-[#042558]/70">
                        {(emp.sector_id && areaById.get(emp.sector_id)?.nome) || "—"}
                      </td>
                      <td className="px-3 py-2 text-[#042558]/70">
                        {positionById.get(emp.position_id)?.nome ?? "—"}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
                          {status}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          {!link || link.status === "expired" ? (
                            <button
                              onClick={() => void gerar(emp)}
                              disabled={!configId || generating === emp.id}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-[#042558] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#042558]/90 disabled:opacity-40"
                            >
                              <Plus className="h-3.5 w-3.5" /> Gerar link
                            </button>
                          ) : null}
                          {link && link.status === "pending" && (
                            <>
                              <button
                                onClick={() => void copiar(link.token)}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-[#042558]/10 px-3 py-1.5 text-xs font-medium text-[#042558] hover:bg-[#042558]/20"
                              >
                                <Copy className="h-3.5 w-3.5" /> Copiar link
                              </button>
                              <button
                                onClick={() => void cancelar(link)}
                                className="rounded-lg p-1.5 text-[#042558]/40 hover:bg-red-50 hover:text-red-600"
                                title="Cancelar link"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          {link && link.status === "answered" && (
                            <button
                              onClick={() => void abrirResposta(link)}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600/10 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-600/20"
                            >
                              <Eye className="h-3.5 w-3.5" /> Ver resposta
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-[#042558]/10 bg-white/60 p-5 shadow-sm">
        <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-[#042558]">
            Kanban de atividades ({links.length})
          </h3>
        </div>
        {loading ? (
          <div className="py-6 text-center text-sm text-[#042558]/60">Carregando...</div>
        ) : links.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-[#042558]/15 p-6 text-center text-sm text-[#042558]/40">
            Nenhum link gerado ainda.
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            {ACTIVITY_STAGES.map((stage) => {
              const Icon = stage.icon;
              const items = links.filter((link) => stageFor(link) === stage.key);

              return (
                <section
                  key={stage.key}
                  className="flex min-h-[280px] flex-col rounded-2xl border border-[#042558]/10 bg-white/60 p-4 shadow-sm transition-all hover:shadow-lg"
                >
                  <header className="mb-4 flex items-center justify-between border-b border-[#042558]/10 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="rounded-md bg-[#042558]/10 p-1.5">
                        <Icon className={`h-4 w-4 ${stage.iconClass}`} />
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
                    <div className="flex flex-1 flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#042558]/20 p-8 text-center">
                      <Link2 className="mb-2 h-8 w-8 text-[#042558]/30" />
                      <p className="text-xs text-[#042558]/40">{stage.empty}</p>
                    </div>
                  ) : (
                    <div className="flex-1 space-y-3">
                      {items.map((l) => (
                        <ActivityLinkCard
                          key={l.id}
                          link={l}
                          onCopy={copiar}
                          onOpenResponse={abrirResposta}
                          onCancel={cancelar}
                          onReactivate={reativar}
                        />
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>

      {openResp && configFields && (
        <ResponseDrawer data={openResp} fields={configFields} onClose={() => setOpenResp(null)} />
      )}
    </div>
  );
}

export function ActivityCompilationPanel({ projectId }: { projectId: string }) {
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [configFields, setConfigFields] = useState<{
    header: ActivityField[];
    questions: ActivityField[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: cfg }, { data: ls }, { data: rs, error }] = await Promise.all([
      supabase
        .from("activity_configs")
        .select("header_schema,questions_schema")
        .eq("project_id", projectId)
        .maybeSingle(),
      supabase
        .from("activity_links")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false }),
      supabase
        .from("activity_responses")
        .select("*")
        .eq("project_id", projectId)
        .order("submitted_at", { ascending: true }),
    ]);

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    setConfigFields({
      header: normalizeActivityFields((cfg?.header_schema as ActivityField[] | null) ?? []).filter(
        includeInCompilation,
      ),
      questions: normalizeActivityFields(
        (cfg?.questions_schema as ActivityField[] | null) ?? [],
      ).filter(includeInCompilation),
    });
    setLinks(((ls ?? []) as LinkRow[]).filter((link) => link.status === "answered"));
    setResponses(((rs ?? []) as ResponseRow[]).filter((response) => response.link_id));
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const linksById = new Map(links.map((link) => [link.id, link]));
  const completedResponses = responses.filter((response) => linksById.has(response.link_id));
  const fields = configFields ?? { header: [], questions: [] };

  const previewCompilation = () => {
    if (!completedResponses.length) {
      toast.error("Ainda não há atividades concluídas para compilar.");
      return;
    }
    setPreviewOpen(true);
  };

  const downloadCompilation = () => {
    const blob = buildActivityResponsesPdf({
      responses: completedResponses,
      fields,
    });
    downloadBlob(
      blob,
      `compilacao-respostas-atividades-${new Date().toISOString().slice(0, 10)}.pdf`,
    );
    toast.success("PDF da compilação baixado");
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-[#042558]/10 bg-white/70 p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-[#042558]">
              Atividades concluídas
            </h3>
            <p className="mt-1 text-sm text-[#042558]/60">
              {completedResponses.length} resposta(s) pronta(s) para compilar
            </p>
          </div>
          <button
            onClick={previewCompilation}
            disabled={loading || completedResponses.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#042558] px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-[#042558]/20 transition-all hover:bg-[#042558]/90 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Eye className="h-4 w-4" />
            Gerar compilação
          </button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-[#042558]/10 bg-white/60 p-8 text-center text-sm text-[#042558]/60">
          Carregando...
        </div>
      ) : completedResponses.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-[#042558]/15 bg-white/50 p-8 text-center text-sm text-[#042558]/40">
          Nenhuma atividade respondida ainda.
        </div>
      ) : (
        <div className="grid gap-3">
          {completedResponses.map((response) => {
            const link = linksById.get(response.link_id);
            return (
              <article
                key={response.id}
                className="rounded-xl border border-[#042558]/10 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-[#042558]">
                      {link?.label ?? "Sem rótulo"}
                    </h4>
                    <p className="mt-1 text-xs text-[#042558]/50">
                      Respondido {new Date(response.submitted_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <span className="w-fit rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                    Concluído
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {previewOpen && (
        <CompilationPreview
          responses={completedResponses}
          fields={fields}
          onClose={() => setPreviewOpen(false)}
          onDownload={downloadCompilation}
        />
      )}
    </div>
  );
}

function CompilationPreview({
  responses,
  fields,
  onClose,
  onDownload,
}: {
  responses: ResponseRow[];
  fields: { header: ActivityField[]; questions: ActivityField[] };
  onClose: () => void;
  onDownload: () => void;
}) {
  const sections = buildCompilationSections(responses, fields);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-4 md:p-8" onClick={onClose}>
      <div
        className="mx-auto max-w-4xl rounded-2xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex flex-col gap-3 border-b border-[#042558]/10 bg-white/95 p-5 backdrop-blur md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-[#042558]">Pré-visualização da compilação</h3>
            <p className="text-sm text-[#042558]/60">
              {responses.length} resposta(s) serão incluídas no PDF
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-[#042558]/20 bg-white px-4 py-2 text-sm font-medium text-[#042558] hover:bg-[#042558]/5"
            >
              Fechar
            </button>
            <button
              onClick={onDownload}
              className="inline-flex items-center gap-2 rounded-lg bg-[#042558] px-4 py-2 text-sm font-medium text-white hover:bg-[#042558]/90"
            >
              <Download className="h-4 w-4" />
              Baixar PDF
            </button>
          </div>
        </div>

        <div className="bg-slate-100 p-4 md:p-8">
          <div className="mx-auto min-h-[860px] max-w-[760px] bg-white p-8 text-[#042558] shadow-sm">
            <h1 className="text-2xl font-bold">Compilação de respostas das atividades</h1>
            <p className="mt-2 text-sm text-[#042558]/60">Total de respostas: {responses.length}</p>

            <div className="mt-8 space-y-8">
              {sections.map((section) => (
                <section key={section.title} className="border-t border-[#042558]/10 pt-6">
                  <h2 className="text-lg font-semibold">{section.title}</h2>
                  <div className="mt-5 space-y-6">
                    {section.items.map((item) => (
                      <div key={item.id}>
                        <h3 className="text-sm font-semibold text-[#042558]/80">{item.label}</h3>
                        {item.answers.length ? (
                          <div className="mt-2 space-y-2">
                            {item.answers.map((answer, index) => (
                              <p
                                key={`${item.id}-${index}`}
                                className="whitespace-pre-wrap rounded-lg bg-[#042558]/5 px-3 py-2 text-sm leading-6 text-[#042558]"
                              >
                                {answer}
                              </p>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-2 italic text-[#042558]/30">sem respostas registradas</p>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ActivityLinkCard({
  link,
  onCopy,
  onOpenResponse,
  onCancel,
  onReactivate,
}: {
  link: LinkRow;
  onCopy: (token: string) => void;
  onOpenResponse: (link: LinkRow) => void;
  onCancel: (link: LinkRow) => void;
  onReactivate: (link: LinkRow) => void;
}) {
  return (
    <article className="group rounded-xl border border-[#042558]/10 bg-white p-4 shadow-sm transition-all hover:border-[#042558]/30 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="truncate text-sm font-semibold text-[#042558]">
            {link.label ?? "Sem rótulo"}
          </h4>
          <p className="mt-1 text-xs text-[#042558]/50">
            Criado {new Date(link.created_at).toLocaleDateString("pt-BR")}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[link.status]}`}
        >
          {STATUS_LABEL[link.status]}
          {link.status === "answered" && !link.reviewed_at && " · novo"}
        </span>
      </div>

      <div className="mt-3 space-y-1 text-xs text-[#042558]/50">
        <p>Expira {new Date(link.expires_at).toLocaleDateString("pt-BR")}</p>
        {link.draft_saved_at && link.status === "pending" && (
          <p>Rascunho salvo {new Date(link.draft_saved_at).toLocaleDateString("pt-BR")}</p>
        )}
        {link.answered_at && (
          <p>Respondido {new Date(link.answered_at).toLocaleDateString("pt-BR")}</p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#042558]/10 pt-3">
        <button
          onClick={() => onCopy(link.token)}
          className="rounded-lg p-2 text-[#042558]/60 hover:bg-[#042558]/5"
          title="Copiar link"
        >
          <Copy className="h-4 w-4" />
        </button>
        {link.status === "answered" && (
          <button
            onClick={() => onOpenResponse(link)}
            className="inline-flex items-center gap-1 rounded-lg bg-[#042558]/10 px-3 py-1.5 text-xs font-medium text-[#042558] hover:bg-[#042558]/20"
          >
            <Eye className="h-3.5 w-3.5" /> Ver resposta
          </button>
        )}
        {link.status === "pending" && (
          <button
            onClick={() => onCancel(link)}
            className="rounded-lg p-2 text-[#042558]/40 hover:bg-red-50 hover:text-red-600"
            title="Cancelar"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
        {link.status === "expired" && (
          <button
            onClick={() => onReactivate(link)}
            className="inline-flex items-center gap-1 rounded-lg bg-[#042558]/10 px-3 py-1.5 text-xs font-medium text-[#042558] hover:bg-[#042558]/20"
            title="Reabrir por 3 dias"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reabrir por 3 dias
          </button>
        )}
      </div>
    </article>
  );
}

function includeInCompilation(field: ActivityField) {
  const key = normalizeCompilationField(`${field.id} ${field.label}`);
  return !(
    key.includes("data inicio") ||
    key.includes("data de inicio") ||
    key.includes("data finalizacao") ||
    key.includes("data de finalizacao") ||
    key.includes("data fim") ||
    key.includes("data de fim")
  );
}

function normalizeCompilationField(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function questionAnswerGroups(
  answers?: QuestionAnswerGroup | QuestionAnswerGroup[] | null,
): QuestionAnswerGroup[] {
  if (Array.isArray(answers)) return answers.length ? answers : [{}];
  if (answers && typeof answers === "object") return [answers];
  return [{}];
}

function buildActivityResponsesPdf({
  responses,
  fields,
}: {
  responses: ResponseRow[];
  fields: { header: ActivityField[]; questions: ActivityField[] };
}) {
  const sections = buildCompilationSections(responses, fields);
  const lines: Array<{ text: string; size?: number; gap?: number }> = [
    { text: "Compilacao de respostas das atividades", size: 18, gap: 10 },
    { text: `Gerado em ${new Date().toLocaleString("pt-BR")}`, size: 10, gap: 18 },
    { text: `Total de respostas: ${responses.length}`, size: 11, gap: 20 },
  ];

  sections.forEach((section) => {
    lines.push({ text: section.title, size: 14, gap: 10 });
    section.items.forEach((item) => {
      lines.push({ text: `${item.label}:`, size: 11, gap: 6 });
      if (item.answers.length) {
        item.answers.forEach((answer) => {
          wrapPdfText(answer, 92).forEach((line) => {
            lines.push({ text: `  ${line}`, size: 10, gap: 3 });
          });
          lines.push({ text: "", gap: 5 });
        });
      } else {
        lines.push({ text: "  sem respostas registradas", size: 10, gap: 8 });
      }
    });
    lines.push({ text: "", gap: 18 });
  });

  return createPdfBlob(lines);
}

function buildCompilationSections(
  responses: ResponseRow[],
  fields: { header: ActivityField[]; questions: ActivityField[] },
) {
  return [
    {
      title: "Cabecalho",
      items: fields.header
        .filter((field) => (field.active ?? true) && includeInCompilation(field))
        .map((field) => ({
          id: field.id,
          label: field.label,
          answers: responses
            .map((response) => response.header_answers?.[field.id]?.trim())
            .filter(isFilledAnswer),
        })),
    },
    {
      title: "Perguntas",
      items: fields.questions
        .filter((field) => (field.active ?? true) && includeInCompilation(field))
        .map((field) => ({
          id: field.id,
          label: field.label,
          answers: responses.flatMap((response) =>
            questionAnswerGroups(response.question_answers)
              .map((answers) => answers?.[field.id]?.trim())
              .filter(isFilledAnswer),
          ),
        })),
    },
  ].filter((section) => section.items.length);
}

function isFilledAnswer(value: string | undefined): value is string {
  return Boolean(value && value.trim());
}

function wrapPdfText(text: string, maxChars: number) {
  const source = text.replace(/\r/g, "").split("\n");
  const wrapped: string[] = [];

  source.forEach((line) => {
    const words = line.split(/\s+/).filter(Boolean);
    if (!words.length) {
      wrapped.push("");
      return;
    }

    let current = "";
    words.forEach((word) => {
      if (!current) {
        current = word;
      } else if (`${current} ${word}`.length <= maxChars) {
        current = `${current} ${word}`;
      } else {
        wrapped.push(current);
        current = word;
      }

      while (current.length > maxChars) {
        wrapped.push(current.slice(0, maxChars));
        current = current.slice(maxChars);
      }
    });
    if (current) wrapped.push(current);
  });

  return wrapped;
}

function createPdfBlob(lines: Array<{ text: string; size?: number; gap?: number }>) {
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const marginX = 48;
  const marginTop = 52;
  const marginBottom = 52;
  const defaultSize = 10;
  const pages: string[][] = [[]];
  let y = pageHeight - marginTop;

  const addPage = () => {
    pages.push([]);
    y = pageHeight - marginTop;
  };

  lines.forEach((line) => {
    const size = line.size ?? defaultSize;
    const gap = line.gap ?? 4;
    const lineHeight = size + gap;

    if (y - lineHeight < marginBottom) addPage();
    if (line.text) {
      pages[pages.length - 1].push(
        `BT /F1 ${size} Tf ${marginX} ${y.toFixed(2)} Td (${escapePdfText(line.text)}) Tj ET`,
      );
    }
    y -= lineHeight;
  });

  return buildPdf(pages, pageWidth, pageHeight);
}

function escapePdfText(text: string) {
  return text
    .replace(/[–—]/g, "-")
    .replace(/\u00a0/g, " ")
    .split("")
    .map((char) => {
      const code = char.charCodeAt(0);
      if (char === "\\" || char === "(" || char === ")") return `\\${char}`;
      if (code >= 32 && code <= 255) return char;
      return "?";
    })
    .join("");
}

function buildPdf(pageContents: string[][], width: number, height: number) {
  const objects: string[] = [];
  const pageCount = pageContents.length;
  const pageObjectStart = 3;
  const contentObjectStart = pageObjectStart + pageCount;
  const fontObjectId = contentObjectStart + pageCount;
  const pageIds = pageContents.map((_, index) => pageObjectStart + index);

  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageCount} >>`;

  pageContents.forEach((content, index) => {
    const pageObjectId = pageObjectStart + index;
    const contentObjectId = contentObjectStart + index;
    const stream = content.join("\n");
    objects[pageObjectId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 ${fontObjectId} 0 R >> >> /Contents ${contentObjectId} 0 R >>`;
    objects[contentObjectId] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });

  objects[fontObjectId] =
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = pdf.length;
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1) {
    pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i += 1) bytes[i] = pdf.charCodeAt(i) & 0xff;
  return new Blob([bytes], { type: "application/pdf" });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function FieldInput({
  field,
  value,
  onChange,
  areas = [],
  parentAreaId,
}: {
  field: ActivityField;
  value: string;
  onChange: (value: string) => void;
  areas?: ProjectArea[];
  parentAreaId?: string;
}) {
  const base =
    "w-full rounded-lg border border-[#042558]/20 bg-white/60 px-3 py-2 text-sm text-[#042558] outline-none focus:border-[#042558]";
  const areaOptions = areas.filter((area) => !area.parent_id);
  const setorOptions = areas.filter(
    (area) => area.parent_id && (!parentAreaId || area.parent_id === parentAreaId),
  );
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-[#042558]/70">
        {field.label} {field.required && <span className="text-red-500">*</span>}
      </span>
      {field.type === "textarea" ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className={base}
        />
      ) : field.dataSource === "areas" ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} className={base}>
          <option value="">Selecione</option>
          {areaOptions.map((area) => (
            <option key={area.id} value={area.id}>
              {area.nome}
            </option>
          ))}
        </select>
      ) : field.dataSource === "setores" ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={base}
          disabled={!parentAreaId}
        >
          <option value="">{parentAreaId ? "Selecione" : "Selecione a Área primeiro"}</option>
          {setorOptions.map((area) => (
            <option key={area.id} value={area.id}>
              {area.nome}
            </option>
          ))}
        </select>
      ) : field.type === "select" ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} className={base}>
          <option value="">Selecione</option>
          {(field.options ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : field.type === "date" ? (
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={base}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={base}
        />
      )}
    </label>
  );
}

function ResponseDrawer({
  data,
  fields,
  onClose,
}: {
  data: { link: LinkRow; response: ResponseRow | null };
  fields: { header: ActivityField[]; questions: ActivityField[] };
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div
        className="h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-xl text-[#042558]">Resposta</h3>
          <button onClick={onClose} className="text-[#042558]/60 hover:text-[#042558]">
            ×
          </button>
        </div>
        <p className="text-xs text-[#042558]/50">
          {data.link.label ?? "Sem rótulo"} · Enviado{" "}
          {data.response ? new Date(data.response.submitted_at).toLocaleString("pt-BR") : "-"}
        </p>

        {!data.response ? (
          <p className="mt-6 text-sm text-[#042558]/60">Sem resposta registrada.</p>
        ) : (
          <>
            <Section
              title="Cabeçalho"
              fields={fields.header.filter((field) => field.active ?? true)}
              answers={data.response.header_answers}
            />
            {questionAnswerGroups(data.response.question_answers).map((answers, index) => (
              <Section
                key={index}
                title={`Pergunta ${index + 1}`}
                fields={fields.questions.filter((field) => field.active ?? true)}
                answers={answers}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  fields,
  answers,
}: {
  title: string;
  fields: ActivityField[];
  answers: Record<string, string>;
}) {
  return (
    <div className="mt-6">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-[#042558]/60">{title}</h4>
      <dl className="mt-2 space-y-3">
        {fields.map((f) => (
          <div key={f.id}>
            <dt className="text-xs font-medium text-[#042558]/70">{f.label}</dt>
            <dd className="mt-0.5 whitespace-pre-wrap text-sm text-[#042558]">
              {answers[f.id] || <span className="italic text-[#042558]/30">sem resposta</span>}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
