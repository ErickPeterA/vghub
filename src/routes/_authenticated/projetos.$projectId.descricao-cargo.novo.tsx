import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DCForm } from "@/components/DCForm";
import { emptyDC, type DescricaoCargo } from "@/lib/dc-types";
import { useCurrentUser } from "@/hooks/use-current-user";
import { logAction } from "@/lib/history";

export const Route = createFileRoute("/_authenticated/projetos/$projectId/descricao-cargo/novo")({
  component: NovaDC,
});

function NovaDC() {
  const { projectId } = Route.useParams();
  const { user } = useCurrentUser();
  const navigate = useNavigate();

  const onSubmit = async (dc: DescricaoCargo) => {
    if (!user) return;
    const { id: _omit, ...payload } = dc;
    void _omit;
    const { data, error } = await supabase
      .from("descricoes_cargo")
      .insert({
        ...payload,
        project_id: projectId,
        created_by: user.id,
        data_versao: payload.data_versao || null,
        data_revisao: payload.data_revisao || null,
      })
      .select("id").single();
    if (error) { toast.error(error.message); return; }
    await logAction({ projectId, acao: "dc_criada", entidade: "descricao_cargo", entidadeId: data.id, detalhes: { cargo: dc.cargo } });
    toast.success("Descrição criada");
    navigate({ to: "/projetos/$projectId/descricao-cargo", params: { projectId } });
  };

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="mb-6 font-display text-4xl">Nova descrição de cargo</h1>
      <DCForm projectId={projectId} initial={emptyDC()} onSubmit={onSubmit} submitLabel="Criar descrição" />
    </main>
  );
}
