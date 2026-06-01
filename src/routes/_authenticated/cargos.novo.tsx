import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { DCForm } from "@/components/DCForm";
import { emptyDC, type DescricaoCargo } from "@/lib/dc-types";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/cargos/novo")({
  component: NovoCargo,
});

function NovoCargo() {
  const navigate = useNavigate();

  const save = async (dc: DescricaoCargo) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const payload = {
      ...dc,
      data_versao: dc.data_versao || null,
      data_revisao: dc.data_revisao || null,
      user_id: user.id,
    };
    const { data, error } = await supabase
      .from("descricoes_cargo")
      .insert(payload)
      .select("id")
      .single();
    if (error) return toast.error(error.message);
    toast.success("Cargo cadastrado");
    navigate({ to: "/cargos/$id", params: { id: data.id } });
  };

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Link to="/dashboard" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>
      <div className="mb-8">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Novo registro</p>
        <h1 className="mt-2 font-display text-5xl">Cadastrar cargo</h1>
      </div>
      <DCForm initial={emptyDC()} onSubmit={save} submitLabel="Criar cargo" />
    </main>
  );
}
