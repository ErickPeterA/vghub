import { createFileRoute, redirect } from "@tanstack/react-router";
import { BaseManager } from "@/components/BaseManager";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUserSafely, withTimeout } from "@/lib/auth-safe";

export const Route = createFileRoute("/_authenticated/gerenciamento/bases")({
  // Proteção feita no beforeLoad — sem useEffect/navigate que causam loop
  beforeLoad: async () => {
    const user = await getCurrentUserSafely();
    if (!user) throw redirect({ to: "/login" });
    const { data } = await withTimeout(
      supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle(),
      8_000,
      "Não foi possível validar permissões.",
    );
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
