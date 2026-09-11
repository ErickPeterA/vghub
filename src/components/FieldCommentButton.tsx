import { useEffect, useState } from "react";
import { MessageSquare, ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { apiJson } from "@/lib/api";

type Comment = {
  id: string;
  author_id: string;
  content: string;
  created_at: string;
  version_id: string | null;
  decision: "pending" | "approved" | "rejected";
  decided_at: string | null;
  decided_by: string | null;
  approved_version_id: string | null;
};

export type FieldCommentDecisionEvent = {
  fieldKey: string;
  commentId: string;
  decision: "approved" | "rejected";
};

export function FieldCommentButton({
  dcId,
  fieldKey,
  versionId,
  canAdd,
  canDecide = false,
  onChange,
  onDecision,
}: {
  dcId: string;
  fieldKey: string;
  versionId: string | null;
  canAdd: boolean;
  canDecide?: boolean;
  onChange?: () => void | Promise<void>;
  onDecision?: (event: FieldCommentDecisionEvent) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [authors, setAuthors] = useState<Record<string, string>>({});

  const load = async () => {
    const params = new URLSearchParams({ fieldKey });
    if (versionId) params.set("versionId", versionId);
    const data = await apiJson<{
      ok: boolean;
      comments: Comment[];
      authors: Record<string, string>;
    }>(`/api/dc/${dcId}/comments?${params.toString()}`);
    setComments(data.comments ?? []);
    setAuthors((current) => ({ ...current, ...(data.authors ?? {}) }));
  };
  const decide = async (commentId: string, decision: "approved" | "rejected") => {
    setLoading(true);
    try {
      await apiJson(`/api/dc/${dcId}/comments`, {
        method: "PATCH",
        body: { commentId, decision },
      });
      toast.success(decision === "approved" ? "Comentario aprovado" : "Comentario reprovado");
      await load();
      await onChange?.();
      if (decision === "approved") {
        setOpen(false);
        await onDecision?.({ fieldKey, commentId, decision });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao avaliar comentario.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [dcId, fieldKey, versionId]);

  const submit = async () => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      await apiJson(`/api/dc/${dcId}/comments`, {
        method: "POST",
        body: {
          fieldKey,
          versionId,
          content: text.trim(),
        },
      });
      setText("");
      await load();
      await onChange?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao comentar.");
    } finally {
      setLoading(false);
    }
  };
  const count = comments.length;
  const pendingCount = comments.filter((comment) => comment.decision === "pending").length;
  const hasPending = pendingCount > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          form="field-comment-trigger"
          className={`relative inline-flex h-7 min-w-7 items-center justify-center rounded-md border px-1.5 text-[11px] transition ${
            hasPending
              ? "border-amber-400 bg-amber-100 text-amber-800 shadow-sm ring-1 ring-amber-200"
              : count > 0
                ? "border-amber-200 bg-amber-50 text-amber-700"
                : "border-border text-muted-foreground hover:bg-secondary"
          }`}
          title="Comentários"
        >
          <MessageSquare className="h-3 w-3" />
          {hasPending ? (
            <span className="absolute -right-1.5 -top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold leading-none text-white">
              {pendingCount}
            </span>
          ) : (
            count > 0 && <span className="ml-1 font-semibold">{count}</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="end">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Comentários
        </p>
        <div className="max-h-56 space-y-2 overflow-y-auto">
          {comments.length === 0 && (
            <p className="text-xs italic text-muted-foreground">Sem comentários.</p>
          )}
          {comments.map((c) => (
            <div
              key={c.id}
              className={`rounded-md border p-2 text-xs ${
                c.decision === "pending"
                  ? "border-amber-300 bg-amber-50/80"
                  : "border-border bg-background"
              }`}
            >
              <div className="mb-1 flex items-center justify-between text-[10px] text-muted-foreground">
                <span className="font-medium">{authors[c.author_id] ?? "—"}</span>
                <span>{new Date(c.created_at).toLocaleString("pt-BR")}</span>
              </div>
              <p className="whitespace-pre-wrap">{c.content}</p>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
                {c.decision === "pending" ? (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                    Pendente
                  </span>
                ) : (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${c.decision === "approved" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}
                  >
                    {c.decision === "approved" ? "Aprovado" : "Reprovado"}
                  </span>
                )}
                {canDecide && c.decision === "pending" && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => decide(c.id, "approved")}
                      disabled={loading}
                      className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                      title="Aprovar comentario"
                    >
                      <ThumbsUp className="h-3 w-3" />
                      Aprovar
                    </button>
                    <button
                      type="button"
                      onClick={() => decide(c.id, "rejected")}
                      disabled={loading}
                      className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-1 text-[10px] font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                      title="Reprovar comentario"
                    >
                      <ThumbsDown className="h-3 w-3" />
                      Reprovar
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        {canAdd && (
          <div className="mt-3 space-y-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              placeholder="Escreva um comentário..."
              className="w-full rounded-md border border-border bg-background p-2 text-xs outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="button"
              onClick={submit}
              disabled={loading || !text.trim()}
              className="w-full rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-50"
            >
              {loading ? "Enviando..." : "Adicionar comentário"}
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

