import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DCForm } from "@/components/DCForm";
import { emptyDC, type DescricaoCargo } from "@/lib/dc-types";
import { logAction } from "@/lib/history";

export const Route = createFileRoute("/_authenticated/projetos/$projectId/descricao-cargo/$dcId")({
  component: EditDC,
});

function EditDC() {
  const { projectId, dcId } = Route.useParams();
  const navigate = useNavigate();
  const [initial, setInitial] = useState<DescricaoCargo | null>(null);

  useEffect(() => {
    supabase.from("descricoes_cargo").select("*").eq("id", dcId).maybeSingle().then(({ data, error }) => {
      if (error || !data) { toast.error("Não encontrado"); navigate({ to: "/projetos/$projectId/descricao-cargo", params: { projectId } }); return; }
      const base = emptyDC();
      setInitial({ ...base, ...(data as unknown as Partial<DescricaoCargo>), data_versao: data.data_versao ?? "", data_revisao: data.data_revisao ?? "" } as DescricaoCargo);
    });
  }, [dcId, projectId, navigate]);

  const onSubmit = async (dc: DescricaoCargo) => {
    const { id: _omit, ...payload } = dc;
    void _omit;
    const { error } = await supabase
      .from("descricoes_cargo")
      .update({ ...payload, data_versao: payload.data_versao || null, data_revisao: payload.data_revisao || null })
      .eq("id", dcId);
    if (error) { toast.error(error.message); return; }
    await logAction({ projectId, acao: "dc_atualizada", entidade: "descricao_cargo", entidadeId: dcId, detalhes: { cargo: dc.cargo } });
    toast.success("Atualizado");
  };

  if (!initial) return <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">Carregando...</div>;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="mb-6 font-display text-4xl">Editar descrição</h1>
      <DCForm projectId={projectId} initial={initial} onSubmit={onSubmit} submitLabel="Salvar alterações" />
    </main>
  );
}
