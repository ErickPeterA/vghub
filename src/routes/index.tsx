import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  // Redireciona instantaneamente no servidor/antes de renderizar
  // sem flash de tela branca
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      throw redirect({ to: "/projetos" });
    } else {
      throw redirect({ to: "/login" });
    }
  },
  component: () => null,
});
