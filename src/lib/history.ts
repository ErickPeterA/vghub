import { supabase } from "@/integrations/supabase/client";

type JsonObj = Record<string, string | number | boolean | null | string[]>;
export async function logAction(args: {
  projectId: string;
  acao: string;
  entidade?: string;
  entidadeId?: string;
  detalhes?: JsonObj;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("project_history").insert({
    project_id: args.projectId,
    user_id: user.id,
    acao: args.acao,
    entidade: args.entidade ?? null,
    entidade_id: args.entidadeId ?? null,
    detalhes: args.detalhes ?? {},
  });
}
