import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { DCForm } from "@/components/DCForm";
import { emptyDC, type DescricaoCargo } from "@/lib/dc-types";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/cargos/$id")({
  component: EditarCargo,
});

function EditarCargo() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [initial, setInitial] = useState<DescricaoCargo | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("descricoes_cargo")
        .select("*")
        .eq("id", id)
        .single();
      if (error) {
        toast.error(error.message);
        navigate({ to: "/dashboard" });
        return;
      }
      const base = emptyDC();
      setInitial({
        ...base,
        ...data,
        data_versao: data.data_versao ?? "",
        data_revisao: data.data_revisao ?? "",
        objetivo: data.objetivo ?? "",
        unidade_negocio: data.unidade_negocio ?? "",
        departamento: data.departamento ?? "",
        nivelamento: data.nivelamento ?? "",
        superior_imediato: data.superior_imediato ?? "",
        tipo_carreira: data.tipo_carreira ?? "",
        instrucao: (data.instrucao as any) ?? [],
        experiencia: (data.experiencia as any) ?? [],
        conhecimento: (data.conhecimento as any) ?? [],
        atividades: (data.atividades as any) ?? [],
        indicadores: (data.indicadores as any) ?? [],
        habilidades_cargo: (data.habilidades_cargo as any) ?? [],
        habilidades_culturais: (data.habilidades_culturais as any) ?? [],
        postura: (data.postura as any) ?? [],
      });
    })();
  }, [id, navigate]);

  const save = async (dc: DescricaoCargo) => {
    const payload = {
      ...dc,
      data_versao: dc.data_versao || null,
      data_revisao: dc.data_revisao || null,
    };
    delete (payload as any).id;
    const { error } = await supabase
      .from("descricoes_cargo")
      .update(payload)
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Alterações salvas");
  };

  if (!initial) {
    return <div className="p-12 text-center text-sm text-muted-foreground">Carregando...</div>;
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Link to="/dashboard" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>
      <div className="mb-8">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Editando</p>
        <h1 className="mt-2 font-display text-5xl">{initial.cargo || "Cargo"}</h1>
      </div>
      <DCForm initial={initial} onSubmit={save} submitLabel="Salvar alterações" />
    </main>
  );
}
