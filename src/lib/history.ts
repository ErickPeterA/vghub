import { apiFetch } from "@/lib/api";

type JsonObj = Record<string, string | number | boolean | null | string[]>;
export async function logAction(args: {
  projectId: string;
  acao: string;
  entidade?: string;
  entidadeId?: string;
  detalhes?: JsonObj;
}) {
  await apiFetch(`/api/projects/${args.projectId}/history`, {
    method: "POST",
    body: {
      acao: args.acao,
      entidade: args.entidade ?? null,
      entidadeId: args.entidadeId ?? null,
      detalhes: args.detalhes ?? {},
    },
  });
}
