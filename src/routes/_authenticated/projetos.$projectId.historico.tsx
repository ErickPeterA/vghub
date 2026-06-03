import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/projetos/$projectId/historico")({
  component: Historico,
});

type Item = { id: string; acao: string; entidade: string | null; user_id: string | null; detalhes: Record<string, unknown>; created_at: string };

const labelMap: Record<string, string> = {
  projeto_criado: "Projeto criado",
  dc_criada: "Descrição de cargo criada",
  dc_atualizada: "Descrição de cargo atualizada",
  dc_excluida: "Descrição de cargo excluída",
  modelo_criado: "Modelo adicionado",
  modelo_removido: "Modelo removido",
  hub_item_criado: "Item adicionado à Página Central",
  hub_item_removido: "Item removido da Página Central",
};

function Historico() {
  const { projectId } = Route.useParams();
  const [items, setItems] = useState<Item[]>([]);
  const [users, setUsers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("project_history").select("*").eq("project_id", projectId).order("created_at", { ascending: false }).limit(200);
      const list = (data as Item[]) ?? [];
      setItems(list);
      const ids = Array.from(new Set(list.map((i) => i.user_id).filter(Boolean))) as string[];
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id,nome").in("id", ids);
        const map: Record<string, string> = {};
        (profs ?? []).forEach((p) => { map[p.id] = p.nome; });
        setUsers(map);
      }
      setLoading(false);
    })();
  }, [projectId]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Auditoria</p>
        <h1 className="mt-2 font-display text-4xl">Histórico</h1>
        <p className="mt-1 text-sm text-muted-foreground">Registro completo de ações realizadas no projeto.</p>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Carregando...</p> :
       items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <History className="mx-auto h-8 w-8 text-muted-foreground" strokeWidth={1.2} />
          <p className="mt-2 text-sm text-muted-foreground">Nenhuma ação registrada</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3 text-left">Data/Hora</th>
                <th className="px-5 py-3 text-left">Usuário</th>
                <th className="px-5 py-3 text-left">Ação</th>
                <th className="px-5 py-3 text-left">Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-t border-border/60">
                  <td className="px-5 py-3 text-muted-foreground">{new Date(it.created_at).toLocaleString("pt-BR")}</td>
                  <td className="px-5 py-3">{it.user_id ? users[it.user_id] ?? "—" : "—"}</td>
                  <td className="px-5 py-3 font-medium">{labelMap[it.acao] ?? it.acao}</td>
                  <td className="px-5 py-3 text-xs text-muted-foreground">{Object.keys(it.detalhes || {}).length ? JSON.stringify(it.detalhes) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
