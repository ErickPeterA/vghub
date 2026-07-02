import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Link2, Copy, Eye, Trash2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { ActivityField } from "./ActivityConfigManager";

type LinkRow = {
  id: string;
  token: string;
  status: "pending" | "answered" | "expired" | "cancelled";
  expires_at: string;
  answered_at: string | null;
  reviewed_at: string | null;
  label: string | null;
  created_at: string;
};

type ResponseRow = {
  id: string;
  link_id: string;
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

export function ActivityLinksPanel({ projectId, onUnreviewedChange }: { projectId: string; onUnreviewedChange?: (n: number) => void }) {
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [configId, setConfigId] = useState<string | null>(null);
  const [configFields, setConfigFields] = useState<{ header: ActivityField[]; questions: ActivityField[] } | null>(null);
  const [days, setDays] = useState<number>(3);
  const [label, setLabel] = useState("");
  const [loading, setLoading] = useState(true);
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
    // Auto-mark expired
    const now = new Date().toISOString();
    const rows = (ls ?? []) as LinkRow[];
    const toExpire = rows.filter((l) => l.status === "pending" && l.expires_at < now).map((l) => l.id);
    if (toExpire.length) {
      await supabase.from("activity_links").update({ status: "expired" }).in("id", toExpire);
      rows.forEach((l) => { if (toExpire.includes(l.id)) l.status = "expired"; });
    }
    setLinks(rows);
    const unread = rows.filter((l) => l.status === "answered" && !l.reviewed_at).length;
    onUnreviewedChange?.(unread);
    setLoading(false);
  }, [projectId, onUnreviewedChange]);

  useEffect(() => { void load(); }, [load]);

  const gerar = async () => {
    if (!configId) return toast.error("Configure o formulário primeiro.");
    const expires_at = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("activity_links").insert({
      project_id: projectId,
      config_id: configId,
      expires_at,
      label: label || null,
      created_by: userData.user?.id ?? null,
    });
    if (error) return toast.error(error.message);
    setLabel("");
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

  const abrirResposta = async (l: LinkRow) => {
    const { data } = await supabase.from("activity_responses").select("*").eq("link_id", l.id).maybeSingle();
    setOpenResp({ link: l, response: (data as ResponseRow | null) ?? null });
    if (l.status === "answered" && !l.reviewed_at) {
      await supabase.from("activity_links").update({ reviewed_at: new Date().toISOString() }).eq("id", l.id);
      void load();
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#042558]/10 bg-white/60 p-5 shadow-sm">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-[#042558]">Gerar novo link</h3>
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
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#042558]">Links ({links.length})</h3>
        {loading ? (
          <div className="py-6 text-center text-sm text-[#042558]/60">Carregando...</div>
        ) : links.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-[#042558]/15 p-6 text-center text-sm text-[#042558]/40">Nenhum link gerado ainda.</div>
        ) : (
          <div className="space-y-2">
            {links.map((l) => (
              <div key={l.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-[#042558]/10 bg-white/60 p-3">
                <Link2 className="h-4 w-4 text-[#042558]/50" />
                <div className="flex-1 min-w-[180px]">
                  <p className="text-sm font-medium text-[#042558]">{l.label ?? "Sem rótulo"}</p>
                  <p className="text-xs text-[#042558]/50">
                    Criado {new Date(l.created_at).toLocaleDateString("pt-BR")} · Expira {new Date(l.expires_at).toLocaleDateString("pt-BR")}
                    {l.answered_at && ` · Respondido ${new Date(l.answered_at).toLocaleDateString("pt-BR")}`}
                  </p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[l.status]}`}>
                  {STATUS_LABEL[l.status]}
                  {l.status === "answered" && !l.reviewed_at && " ·  novo"}
                </span>
                <button onClick={() => copiar(l.token)} className="rounded-lg p-2 text-[#042558]/60 hover:bg-[#042558]/5" title="Copiar link">
                  <Copy className="h-4 w-4" />
                </button>
                {l.status === "answered" && (
                  <button onClick={() => abrirResposta(l)} className="inline-flex items-center gap-1 rounded-lg bg-[#042558]/10 px-3 py-1.5 text-xs font-medium text-[#042558] hover:bg-[#042558]/20">
                    <Eye className="h-3.5 w-3.5" /> Ver resposta
                  </button>
                )}
                {l.status === "pending" && (
                  <button onClick={() => cancelar(l)} className="rounded-lg p-2 text-[#042558]/40 hover:bg-red-50 hover:text-red-600" title="Cancelar">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {openResp && configFields && (
        <ResponseDrawer data={openResp} fields={configFields} onClose={() => setOpenResp(null)} />
      )}
    </div>
  );
}

function ResponseDrawer({ data, fields, onClose }: { data: { link: LinkRow; response: ResponseRow | null }; fields: { header: ActivityField[]; questions: ActivityField[] }; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div className="h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-xl text-[#042558]">Resposta</h3>
          <button onClick={onClose} className="text-[#042558]/60 hover:text-[#042558]">✕</button>
        </div>
        <p className="text-xs text-[#042558]/50">{data.link.label ?? "Sem rótulo"} · Enviado {data.response ? new Date(data.response.submitted_at).toLocaleString("pt-BR") : "-"}</p>

        {!data.response ? (
          <p className="mt-6 text-sm text-[#042558]/60">Sem resposta registrada.</p>
        ) : (
          <>
            <Section title="Cabeçalho" fields={fields.header} answers={data.response.header_answers} />
            <Section title="Perguntas" fields={fields.questions} answers={data.response.question_answers} />
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
            <dd className="mt-0.5 whitespace-pre-wrap text-sm text-[#042558]">{answers[f.id] || <span className="italic text-[#042558]/30">— sem resposta —</span>}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
