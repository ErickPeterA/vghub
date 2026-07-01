import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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

const acaoColors: Record<string, string> = {
  projeto_criado: "bg-[#042558]/10 text-[#042558]",
  dc_criada: "bg-emerald-50 text-emerald-700",
  dc_atualizada: "bg-blue-50 text-blue-700",
  dc_excluida: "bg-red-50 text-red-700",
  modelo_criado: "bg-purple-50 text-purple-700",
  modelo_removido: "bg-orange-50 text-orange-700",
  hub_item_criado: "bg-indigo-50 text-indigo-700",
  hub_item_removido: "bg-rose-50 text-rose-700",
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

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#042558]/5 via-white to-[#042558]/5 px-6 py-8">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-8 rounded-2xl border border-[#042558]/10 bg-white/80 p-6 shadow-sm backdrop-blur-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#042558]/50">Auditoria</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#042558]">Histórico</h1>
            <p className="mt-1 text-sm text-[#042558]/60">Registro completo de ações realizadas no projeto.</p>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex h-64 items-center justify-center rounded-2xl border border-[#042558]/10 bg-white/60">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#042558] border-t-transparent" />
              <p className="text-sm text-[#042558]/60">Carregando histórico...</p>
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#042558]/20 bg-white/60 p-12">
            <p className="text-sm font-medium text-[#042558]/40">Nenhuma ação registrada</p>
            <p className="text-xs text-[#042558]/30">As ações realizadas no projeto aparecerão aqui</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[#042558]/10 bg-white/60 shadow-sm backdrop-blur-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#042558]/10 bg-[#042558]/5">
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-[#042558]/50">
                      Data/Hora
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-[#042558]/50">
                      Usuário
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-[#042558]/50">
                      Ação
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-[#042558]/50">
                      Detalhes
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, index) => {
                    const acaoLabel = labelMap[it.acao] ?? it.acao;
                    const acaoColor = acaoColors[it.acao] ?? "bg-[#042558]/5 text-[#042558]";
                    const userName = it.user_id ? users[it.user_id] ?? "—" : "—";
                    const hasDetails = it.detalhes && Object.keys(it.detalhes).length > 0;
                    
                    return (
                      <tr 
                        key={it.id} 
                        className={`border-b border-[#042558]/5 transition-colors hover:bg-[#042558]/5 ${
                          index % 2 === 0 ? "bg-white/50" : "bg-white/30"
                        }`}
                      >
                        <td className="whitespace-nowrap px-5 py-3.5 text-xs text-[#042558]/60">
                          {formatDate(it.created_at)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3.5 text-sm font-medium text-[#042558]">
                          {userName}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${acaoColor}`}>
                            {acaoLabel}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-[#042558]/50 font-mono">
                          {hasDetails ? (
                            <details className="cursor-pointer">
                              <summary className="text-[#042558]/40 hover:text-[#042558]/70">Ver detalhes</summary>
                              <pre className="mt-1 rounded bg-[#042558]/5 p-2 text-[10px] text-[#042558]/70 overflow-x-auto">
                                {JSON.stringify(it.detalhes, null, 2)}
                              </pre>
                            </details>
                          ) : (
                            <span className="text-[#042558]/30">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            {/* Footer com contagem */}
            <div className="border-t border-[#042558]/10 bg-[#042558]/5 px-5 py-3">
              <p className="text-xs text-[#042558]/40">
                Mostrando {items.length} registro{items.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}