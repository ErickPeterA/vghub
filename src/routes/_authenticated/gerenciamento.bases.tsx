import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { BaseManager } from "@/components/BaseManager";
import { useCurrentUser } from "@/hooks/use-current-user";

export const Route = createFileRoute("/_authenticated/gerenciamento/bases")({
  component: GeneralBasePage,
});

function GeneralBasePage() {
  const { isAdmin, loading } = useCurrentUser();
  const navigate = useNavigate();
  useEffect(() => { if (!loading && !isAdmin) navigate({ to: "/projetos" }); }, [isAdmin, loading, navigate]);
  if (loading || !isAdmin) return <p className="p-8 text-sm text-muted-foreground">Verificando acesso...</p>;
  return <BaseManager title="Configuração da Base Geral" description="Esta é a base mestre. Novos projetos recebem uma cópia independente de todos estes campos e opções." />;
}