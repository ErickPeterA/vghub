import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { apiJson } from "@/lib/api";
import { History, Clock, User, Tag, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/projetos/$projectId/historico")({
  component: Historico,
});

type Item = {
  id: string;
  acao: string;
  entidade: string | null;
  user_id: string | null;
  detalhes: Record<string, unknown> | null;
  created_at: string;
};

const labelMap: Record<string, string> = {
  projeto_criado: "Projeto criado",
  dc_criada: "Descrição de cargo criada",
  dc_atualizada: "Descrição de cargo atualizada",
  dc_excluida: "Descrição de cargo excluída",
  dc_etapa: "Etapa alterada",
  dc_revisao_finalizada: "Revisão finalizada",
  dc_aprovada: "Descrição de cargo aprovada",
  membro_vinculado: "Membro vinculado",
  papel_membro_alterado: "Papel alterado",
  membro_removido: "Membro removido",
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
  dc_etapa: "bg-sky-50 text-sky-700",
  dc_revisao_finalizada: "bg-emerald-50 text-emerald-700",
  dc_aprovada: "bg-emerald-50 text-emerald-700",
  membro_vinculado: "bg-indigo-50 text-indigo-700",
  papel_membro_alterado: "bg-amber-50 text-amber-700",
  membro_removido: "bg-rose-50 text-rose-700",
  modelo_criado: "bg-purple-50 text-purple-700",
  modelo_removido: "bg-orange-50 text-orange-700",
  hub_item_criado: "bg-indigo-50 text-indigo-700",
  hub_item_removido: "bg-rose-50 text-rose-700",
};

const stageLabels: Record<string, string> = {
  em_criacao: "Em criação",
  em_aprovacao: "Em aprovação",
  concluido: "Concluído",
};

const roleLabels: Record<string, string> = {
  admin: "Administrador",
  gp: "GP",
  lider_estrategico: "Líder estratégico",
  lider: "Líder",
};

const detailLabels: Record<string, string> = {
  cargo: "Cargo",
  nome: "Nome",
  user_id: "Usuário",
  role: "Papel",
  de: "De",
  para: "Para",
  comentarios: "Comentários",
};

function formatDate(date: string) {
  return new Date(date).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatValue(key: string, value: unknown, users: Record<string, string>): string {
  if (value === null || value === undefined || value === "") return "Não informado";
  if (key === "user_id" && typeof value === "string") return users[value] ?? value;
  if ((key === "de" || key === "para") && typeof value === "string")
    return stageLabels[value] ?? value;
  if (key === "role" && typeof value === "string") return roleLabels[value] ?? value;
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (Array.isArray(value)) return value.map((item) => formatValue(key, item, users)).join(", ");
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(
        ([childKey, childValue]) =>
          `${detailLabels[childKey] ?? childKey}: ${formatValue(childKey, childValue, users)}`,
      )
      .join("; ");
  }
  return String(value);
}

function formatDetails(item: Item, users: Record<string, string>) {
  const details = item.detalhes ?? {};
  const cargo = formatValue("cargo", details.cargo, users);
  const targetUser = formatValue("user_id", details.user_id, users);
  const role = formatValue("role", details.role, users);
  const fromStage = formatValue("de", details.de, users);
  const toStage = formatValue("para", details.para, users);

  switch (item.acao) {
    case "projeto_criado":
      return `Projeto: ${formatValue("nome", details.nome, users)}`;
    case "dc_criada":
    case "dc_atualizada":
    case "dc_excluida":
      return `Cargo: ${cargo}`;
    case "dc_etapa":
      return `Etapa alterada de ${fromStage} para ${toStage}`;
    case "dc_revisao_finalizada":
      return `${formatValue("comentarios", details.comentarios, users)} comentário(s). Status: ${toStage}`;
    case "dc_aprovada":
      return `Status alterado para ${toStage}`;
    case "membro_vinculado":
      return `Membro: ${targetUser}. Papel: ${role}`;
    case "papel_membro_alterado":
      return `Membro: ${targetUser}. Novo papel: ${role}`;
    case "membro_removido":
      return `Membro removido: ${targetUser}`;
    default: {
      const entries = Object.entries(details);
      if (!entries.length) return "Sem alteração detalhada";
      return entries
        .map(([key, value]) => `${detailLabels[key] ?? key}: ${formatValue(key, value, users)}`)
        .join("; ");
    }
  }
}

function Historico() {
  const { projectId } = Route.useParams();
  const [items, setItems] = useState<Item[]>([]);
  const [users, setUsers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const data = await apiJson<{
          ok: boolean;
          items: Item[];
          users: Record<string, string>;
        }>(`/api/projects/${projectId}/history`);
        if (!active) return;
        setItems(data.items ?? []);
        setUsers(data.users ?? {});
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [projectId]);

  return (
    <main className="min-h-screen bg-[#042558]/5 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        {/* Header melhorado */}
        <div className="mb-8 rounded-xl bg-white p-6 shadow-sm shadow-[#042558]/5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-[#042558] p-2.5">
                <History className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-[#042558]/50">
                  Auditoria
                </p>
                <h1 className="text-2xl font-bold text-[#042558]">Histórico</h1>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-[#042558]/5 px-3.5 py-1.5 text-sm font-medium text-[#042558]">
              <Clock className="h-4 w-4" />
              <span>
                {items.length} registro{items.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
          <p className="mt-3 text-sm text-[#042558]/60">
            Registro das ações realizadas no projeto, com a alteração já visível.
          </p>
        </div>

        {/* Conteúdo */}
        {loading ? (
          <div className="flex h-80 items-center justify-center rounded-xl bg-white shadow-sm shadow-[#042558]/5">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#042558] border-t-transparent" />
              <p className="text-sm text-[#042558]/60">Carregando histórico...</p>
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl bg-white p-12 text-center shadow-sm shadow-[#042558]/5">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#042558]/5">
              <History className="h-8 w-8 text-[#042558]/30" />
            </div>
            <h3 className="text-lg font-medium text-[#042558]/60">Nenhuma ação registrada</h3>
            <p className="mt-1 text-sm text-[#042558]/40">
              As ações realizadas no projeto aparecerão aqui.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const actionLabel = labelMap[item.acao] ?? item.acao;
              const actionColor = acaoColors[item.acao] ?? "bg-[#042558]/5 text-[#042558]";
              const userName = item.user_id
                ? (users[item.user_id] ?? "Usuário não encontrado")
                : "Sistema";
              const detailText = formatDetails(item, users);

              return (
                <div
                  key={item.id}
                  className="group rounded-xl bg-white p-5 shadow-sm shadow-[#042558]/5 transition-all hover:shadow-md hover:shadow-[#042558]/10"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${actionColor}`}
                        >
                          {actionLabel}
                        </span>
                        {item.entidade && (
                          <span className="inline-flex items-center gap-1 text-xs text-[#042558]/40">
                            <Tag className="h-3 w-3" />
                            {item.entidade}
                          </span>
                        )}
                      </div>
                      <p className="text-sm leading-relaxed text-[#042558]/80">{detailText}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1 text-xs">
                      <div className="flex items-center gap-1.5 text-[#042558]/50">
                        <User className="h-3 w-3" />
                        <span>{userName}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[#042558]/40">
                        <Clock className="h-3 w-3" />
                        <span>{formatDate(item.created_at)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
