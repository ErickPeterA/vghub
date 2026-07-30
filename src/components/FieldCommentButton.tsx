import { useEffect, useState } from "react";
import { MessageSquare, ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";

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

export function FieldCommentButton({
  dcId,
  fieldKey,
  versionId,
  canAdd,
  canDecide = false,
  onChange,
}: {
  dcId: string;
  fieldKey: string;
  versionId: string | null;
  canAdd: boolean;
  canDecide?: boolean;
  onChange?: () => void;
}) {
  const { user } = useCurrentUser();
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [authors, setAuthors] = useState<Record<string, string>>({});

  const load = async () => {
    let query = supabase
      .from("field_comments")
      .select(
        "id,author_id,content,created_at,version_id,decision,decided_at,decided_by,approved_version_id",
      )
      .eq("job_description_id", dcId)
      .eq("field_key", fieldKey)
      .order("created_at", { ascending: true });
    if (versionId) query = query.eq("version_id", versionId);
    const { data } = await query;
    const list = (data ?? []) as Comment[];
    setComments(list);
    const authorIds = list
      .flatMap((comment) => [comment.author_id, comment.decided_by])
      .filter(Boolean) as string[];
    const missing = Array.from(new Set(authorIds)).filter((id) => !authors[id]);
    if (missing.length) {
      const { data: profs } = await supabase.from("profiles").select("id,nome").in("id", missing);
      const next = { ...authors };
      (profs ?? []).forEach((p) => {
        next[p.id] = p.nome;
      });
      setAuthors(next);
    }
  };

  const decide = async (commentId: string, decision: "approved" | "rejected") => {
    setLoading(true);
    const { error } = await supabase.rpc("decide_field_comment", {
      _comment_id: commentId,
      _decision: decision,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(decision === "approved" ? "ComentÃ¡rio aprovado" : "ComentÃ¡rio reprovado");
    await load();
    onChange?.();
  };

  useEffect(() => {
    void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [dcId, fieldKey, versionId]);

  const submit = async () => {
    if (!user || !text.trim()) return;
    setLoading(true);
    const { error } = await supabase.from("field_comments").insert({
      job_description_id: dcId,
      field_key: fieldKey,
      version_id: versionId,
      author_id: user.id,
      content: text.trim(),
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setText("");
    await load();
    onChange?.();
  };

  const count = comments.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          form="field-comment-trigger"
          className={`inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[11px] transition ${count > 0 ? "border-amber-300 bg-amber-50 text-amber-700" : "text-muted-foreground hover:bg-secondary"}`}
          title="Comentários"
        >
          <MessageSquare className="h-3 w-3" />
          {count > 0 && <span className="font-semibold">{count}</span>}
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
            <div key={c.id} className="rounded-md border border-border bg-background p-2 text-xs">
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
