import { createFileRoute, redirect } from "@tanstack/react-router";
import { BaseManager } from "@/components/BaseManager";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/gerenciamento/bases")({
  // Proteção feita no beforeLoad — sem useEffect/navigate que causam loop
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/login" });
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!data) throw redirect({ to: "/projetos" });
  },
  component: GeneralBasePage,
});

function GeneralBasePage() {
  return (
    <BaseManager
      title="Configuração da Base Geral"
      description="Esta é a base mestre. Novos projetos recebem uma cópia independente de todos estes campos e opções."
    />
  );
}
