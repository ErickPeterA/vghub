import { useCallback, useEffect, useState } from "react";
import type { ComponentType } from "react";
import { toast } from "sonner";
import { CheckCircle2, Clock3, Copy, Download, Eye, Link2, Plus, RotateCcw, Send, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { ActivityField } from "./ActivityConfigManager";

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
  question_answers: Record<string, string>;
  submitted_at: string;
};

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
  { key: "creating", label: "Em criação", empty: "Nenhuma atividade em criação", icon: Clock3, iconClass: "text-blue-500" },
  { key: "sent", label: "Link enviado", empty: "Nenhum link enviado", icon: Send, iconClass: "text-amber-500" },
  { key: "answered", label: "Respondido", empty: "Nenhuma resposta recebida", icon: CheckCircle2, iconClass: "text-emerald-500" },
];

export function ActivityLinksPanel({ projectId, onUnreviewedChange }: { projectId: string; onUnreviewedChange?: (n: number) => void }) {
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [configId, setConfigId] = useState<string | null>(null);
  const [configFields, setConfigFields] = useState<{ header: ActivityField[]; questions: ActivityField[] } | null>(null);
  const [headerAnswers, setHeaderAnswers] = useState<Record<string, string>>({});
  const [days, setDays] = useState<number>(3);
  const [label, setLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [compiling, setCompiling] = useState(false);
  const [openResp, setOpenResp] = useState<{ link: LinkRow; response: ResponseRow | null } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: cfg }, { data: ls }] = await Promise.all([
      supabase.from("activity_configs").select("id,header_schema,questions_schema").eq("project_id", projectId).maybeSingle(),
      supabase.from("activity_links").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
    ]);
    if (cfg) {
      setConfigId(cfg.id);
      setConfigFields({ header: (cfg.header_schema as ActivityField[]) ?? [], questions: (cfg.questions_schema as ActivityField[]) ?? [] });
    } else {
      setConfigId(null);
      setConfigFields(null);
    }

    const now = new Date().toISOString();
    const rows = (ls ?? []) as LinkRow[];
    const toExpire = rows.filter((l) => l.status === "pending" && l.expires_at < now).map((l) => l.id);
    if (toExpire.length) {
      await supabase.from("activity_links").update({ status: "expired" }).in("id", toExpire);
      rows.forEach((l) => { if (toExpire.includes(l.id)) l.status = "expired"; });
    }
    setLinks(rows);
    onUnreviewedChange?.(rows.filter((l) => l.status === "answered" && !l.reviewed_at).length);
    setLoading(false);
  }, [projectId, onUnreviewedChange]);

  useEffect(() => { void load(); }, [load]);

  const gpHeaderFields = configFields?.header.filter((field) => (field.active ?? true) && (field.filledBy ?? "collaborator") === "gp") ?? [];

  const stageFor = (link: LinkRow): ActivityStage => {
    if (link.status === "answered") return "answered";
    if (link.status === "pending" && link.draft_saved_at) return "creating";
    return "sent";
  };

  const gerar = async () => {
    if (!configId) return toast.error("Configure o formulário primeiro.");
    const missing = gpHeaderFields.find((field) => field.required && !headerAnswers[field.id]?.trim());
    if (missing) return toast.error(`Preencha no cabeçalho: ${missing.label}`);

    const expires_at = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("activity_links").insert({
      project_id: projectId,
      config_id: configId,
      expires_at,
      header_answers: headerAnswers,
      label: label || null,
      created_by: userData.user?.id ?? null,
    });
    if (error) return toast.error(error.message);
    setLabel("");
    setHeaderAnswers({});
    toast.success("Link gerado");
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
    const { error } = await supabase.from("activity_links").update({ status: "cancelled" }).eq("id", l.id);
    if (error) return toast.error(error.message);
    void load();
  };

  const reativar = async (l: LinkRow) => {
    const expires_at = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabase
      .from("activity_links")
      .update({ status: "pending", expires_at })
      .eq("id", l.id);
    if (error) return toast.error(error.message);
    toast.success("Link reativado");
    void load();
  };

  const abrirResposta = async (l: LinkRow) => {
    const { data } = await supabase.from("activity_responses").select("*").eq("link_id", l.id).maybeSingle();
    setOpenResp({ link: l, response: (data as ResponseRow | null) ?? null });
    if (l.status === "answered" && !l.reviewed_at) {
      await supabase.from("activity_links").update({ reviewed_at: new Date().toISOString() }).eq("id", l.id);
      void load();
    }
  };

  const gerarCompilacao = async () => {
    setCompiling(true);
    try {
      const { data, error } = await supabase
        .from("activity_responses")
        .select("*")
        .eq("project_id", projectId)
        .order("submitted_at", { ascending: true });

      if (error) throw error;

      const responses = ((data ?? []) as ResponseRow[]).filter((response) => response.link_id);
      if (!responses.length) {
        toast.error("Ainda não há respostas para compilar.");
        return;
      }

      const linksById = new Map(links.map((link) => [link.id, link]));
      const blob = buildActivityResponsesPdf({
        responses,
        linksById,
        fields: configFields ?? { header: [], questions: [] },
      });
      downloadBlob(blob, `compilacao-respostas-atividades-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success("Compilação gerada");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível gerar a compilação.");
    } finally {
      setCompiling(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#042558]/10 bg-white/60 p-5 shadow-sm">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-[#042558]">Gerar novo link</h3>

        {gpHeaderFields.length > 0 && (
          <div className="mt-3 rounded-xl border border-[#042558]/10 bg-white/50 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#042558]/60">Cabeçalho preenchido pela GP</p>
            <div className="grid gap-3 md:grid-cols-2">
              {gpHeaderFields.map((field) => (
                <FieldInput
                  key={field.id}
                  field={field}
                  value={headerAnswers[field.id] ?? ""}
                  onChange={(value) => setHeaderAnswers((current) => ({ ...current, [field.id]: value }))}
                />
              ))}
            </div>
          </div>
        )}

        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_140px_auto]">
          <input placeholder="Rótulo (ex: João - RH)" value={label} onChange={(e) => setLabel(e.target.value)} className="rounded-lg border border-[#042558]/20 bg-white/60 px-3 py-2 text-sm outline-none focus:border-[#042558]" />
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="rounded-lg border border-[#042558]/20 bg-white/60 px-3 py-2 text-sm">
            <option value={1}>Expira em 1 dia</option>
            <option value={3}>Expira em 3 dias</option>
            <option value={7}>Expira em 7 dias</option>
            <option value={14}>Expira em 14 dias</option>
          </select>
          <button onClick={gerar} disabled={!configId} className="inline-flex items-center gap-1.5 rounded-lg bg-[#042558] px-4 py-2 text-sm font-medium text-white hover:bg-[#042558]/90 disabled:opacity-40">
            <Plus className="h-4 w-4" /> Gerar link
          </button>
        </div>
        {!configId && <p className="mt-2 text-xs text-amber-700">Salve a configuração antes de gerar links.</p>}
      </div>

      <div className="rounded-2xl border border-[#042558]/10 bg-white/60 p-5 shadow-sm">
        <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-[#042558]">Kanban de atividades ({links.length})</h3>
          <button
            onClick={gerarCompilacao}
            disabled={compiling || links.every((link) => link.status !== "answered")}
            className="hidden"
          >
            <Download className="h-4 w-4" />
            {compiling ? "Gerando..." : "Gerar compilação de respostas"}
          </button>
        </div>
        {loading ? (
          <div className="py-6 text-center text-sm text-[#042558]/60">Carregando...</div>
        ) : links.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-[#042558]/15 p-6 text-center text-sm text-[#042558]/40">Nenhum link gerado ainda.</div>
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            {ACTIVITY_STAGES.map((stage) => {
              const Icon = stage.icon;
              const items = links.filter((link) => stageFor(link) === stage.key);

              return (
                <section key={stage.key} className="flex min-h-[280px] flex-col rounded-2xl border border-[#042558]/10 bg-white/60 p-4 shadow-sm transition-all hover:shadow-lg">
                  <header className="mb-4 flex items-center justify-between border-b border-[#042558]/10 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="rounded-md bg-[#042558]/10 p-1.5">
                        <Icon className={`h-4 w-4 ${stage.iconClass}`} />
                      </div>
                      <h2 className="text-sm font-semibold uppercase tracking-wider text-[#042558]">{stage.label}</h2>
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
                          days={days}
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

      <button
        onClick={gerarCompilacao}
        disabled={compiling || links.every((link) => link.status !== "answered")}
        className="fixed bottom-6 right-6 z-40 inline-flex items-center justify-center gap-2 rounded-full bg-[#042558] px-5 py-3 text-sm font-medium text-white shadow-xl shadow-[#042558]/25 transition-all hover:-translate-y-0.5 hover:bg-[#042558]/90 hover:shadow-2xl disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
        title="Gerar compilação de respostas"
      >
        <Download className="h-4 w-4" />
        <span className="hidden sm:inline">{compiling ? "Gerando..." : "Gerar compilação de respostas"}</span>
      </button>
    </div>
  );
}

function ActivityLinkCard({
  link,
  days,
  onCopy,
  onOpenResponse,
  onCancel,
  onReactivate,
}: {
  link: LinkRow;
  days: number;
  onCopy: (token: string) => void;
  onOpenResponse: (link: LinkRow) => void;
  onCancel: (link: LinkRow) => void;
  onReactivate: (link: LinkRow) => void;
}) {
  return (
    <article className="group rounded-xl border border-[#042558]/10 bg-white p-4 shadow-sm transition-all hover:border-[#042558]/30 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="truncate text-sm font-semibold text-[#042558]">{link.label ?? "Sem rótulo"}</h4>
          <p className="mt-1 text-xs text-[#042558]/50">
            Criado {new Date(link.created_at).toLocaleDateString("pt-BR")}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[link.status]}`}>
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
        <button onClick={() => onCopy(link.token)} className="rounded-lg p-2 text-[#042558]/60 hover:bg-[#042558]/5" title="Copiar link">
          <Copy className="h-4 w-4" />
        </button>
        {link.status === "answered" && (
          <button onClick={() => onOpenResponse(link)} className="inline-flex items-center gap-1 rounded-lg bg-[#042558]/10 px-3 py-1.5 text-xs font-medium text-[#042558] hover:bg-[#042558]/20">
            <Eye className="h-3.5 w-3.5" /> Ver resposta
          </button>
        )}
        {link.status === "pending" && (
          <button onClick={() => onCancel(link)} className="rounded-lg p-2 text-[#042558]/40 hover:bg-red-50 hover:text-red-600" title="Cancelar">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
        {(link.status === "expired" || link.status === "cancelled") && (
          <button onClick={() => onReactivate(link)} className="inline-flex items-center gap-1 rounded-lg bg-[#042558]/10 px-3 py-1.5 text-xs font-medium text-[#042558] hover:bg-[#042558]/20" title={`Reativar por ${days} dia${days > 1 ? "s" : ""}`}>
            <RotateCcw className="h-3.5 w-3.5" /> Reativar link
          </button>
        )}
      </div>
    </article>
  );
}

function buildActivityResponsesPdf({
  responses,
  linksById,
  fields,
}: {
  responses: ResponseRow[];
  linksById: Map<string, LinkRow>;
  fields: { header: ActivityField[]; questions: ActivityField[] };
}) {
  const fieldLabelById = new Map<string, string>();
  [...fields.header, ...fields.questions].forEach((field) => fieldLabelById.set(field.id, field.label));

  const lines: Array<{ text: string; size?: number; gap?: number }> = [
    { text: "Compilação de respostas das atividades", size: 18, gap: 10 },
    { text: `Gerado em ${new Date().toLocaleString("pt-BR")}`, size: 10, gap: 18 },
    { text: `Total de respostas: ${responses.length}`, size: 11, gap: 20 },
  ];

  responses.forEach((response, index) => {
    const link = linksById.get(response.link_id);
    lines.push(
      { text: `Resposta ${index + 1} - ${link?.label ?? "Sem rótulo"}`, size: 14, gap: 8 },
      { text: `Enviado em ${new Date(response.submitted_at).toLocaleString("pt-BR")}`, size: 10, gap: 12 },
      { text: "Cabeçalho", size: 12, gap: 6 },
    );
    pushAnswerLines(lines, fields.header, response.header_answers, fieldLabelById);
    lines.push({ text: "Perguntas", size: 12, gap: 6 });
    pushAnswerLines(lines, fields.questions, response.question_answers, fieldLabelById);
    lines.push({ text: "", gap: 18 });
  });

  return createPdfBlob(lines);
}

function pushAnswerLines(
  lines: Array<{ text: string; size?: number; gap?: number }>,
  fields: ActivityField[],
  answers: Record<string, string>,
  fieldLabelById: Map<string, string>,
) {
  const activeFields = fields.filter((field) => field.active ?? true);
  const knownIds = new Set(activeFields.map((field) => field.id));

  if (!activeFields.length && Object.keys(answers ?? {}).length === 0) {
    lines.push({ text: "Sem respostas registradas.", size: 10, gap: 8 });
    return;
  }

  activeFields.forEach((field) => {
    pushWrappedAnswer(lines, field.label, answers?.[field.id]);
  });

  Object.entries(answers ?? {}).forEach(([id, value]) => {
    if (!knownIds.has(id)) pushWrappedAnswer(lines, fieldLabelById.get(id) ?? id, value);
  });
}

function pushWrappedAnswer(lines: Array<{ text: string; size?: number; gap?: number }>, label: string, value?: string) {
  lines.push({ text: `${label}:`, size: 10, gap: 3 });
  wrapPdfText(value?.trim() || "sem resposta", 92).forEach((line) => {
    lines.push({ text: `  ${line}`, size: 10, gap: 3 });
  });
  lines.push({ text: "", gap: 5 });
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
      pages[pages.length - 1].push(`BT /F1 ${size} Tf ${marginX} ${y.toFixed(2)} Td (${escapePdfText(line.text)}) Tj ET`);
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
    objects[pageObjectId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 ${fontObjectId} 0 R >> >> /Contents ${contentObjectId} 0 R >>`;
    objects[contentObjectId] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });

  objects[fontObjectId] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";

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

function FieldInput({ field, value, onChange }: { field: ActivityField; value: string; onChange: (value: string) => void }) {
  const base = "w-full rounded-lg border border-[#042558]/20 bg-white/60 px-3 py-2 text-sm text-[#042558] outline-none focus:border-[#042558]";
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-[#042558]/70">
        {field.label} {field.required && <span className="text-red-500">*</span>}
      </span>
      {field.type === "textarea" ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} className={base} />
      ) : field.type === "select" ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} className={base}>
          <option value="">Selecione</option>
          {(field.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      ) : field.type === "date" ? (
        <input type="date" value={value} onChange={(e) => onChange(e.target.value)} className={base} />
      ) : (
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className={base} />
      )}
    </label>
  );
}

function ResponseDrawer({ data, fields, onClose }: { data: { link: LinkRow; response: ResponseRow | null }; fields: { header: ActivityField[]; questions: ActivityField[] }; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div className="h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-xl text-[#042558]">Resposta</h3>
          <button onClick={onClose} className="text-[#042558]/60 hover:text-[#042558]">×</button>
        </div>
        <p className="text-xs text-[#042558]/50">{data.link.label ?? "Sem rótulo"} · Enviado {data.response ? new Date(data.response.submitted_at).toLocaleString("pt-BR") : "-"}</p>

        {!data.response ? (
          <p className="mt-6 text-sm text-[#042558]/60">Sem resposta registrada.</p>
        ) : (
          <>
            <Section title="Cabeçalho" fields={fields.header.filter((field) => field.active ?? true)} answers={data.response.header_answers} />
            <Section title="Perguntas" fields={fields.questions.filter((field) => field.active ?? true)} answers={data.response.question_answers} />
          </>
        )}
      </div>
    </div>
  );
}

function Section({ title, fields, answers }: { title: string; fields: ActivityField[]; answers: Record<string, string> }) {
  return (
    <div className="mt-6">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-[#042558]/60">{title}</h4>
      <dl className="mt-2 space-y-3">
        {fields.map((f) => (
          <div key={f.id}>
            <dt className="text-xs font-medium text-[#042558]/70">{f.label}</dt>
            <dd className="mt-0.5 whitespace-pre-wrap text-sm text-[#042558]">{answers[f.id] || <span className="italic text-[#042558]/30">sem resposta</span>}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
