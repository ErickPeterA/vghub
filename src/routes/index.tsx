import { createFileRoute, redirect } from "@tanstack/react-router";
import { getCurrentUserSafely } from "@/lib/auth-safe";

export const Route = createFileRoute("/")({
  // Redireciona instantaneamente no servidor/antes de renderizar
  // sem flash de tela branca
  beforeLoad: async () => {
    const user = await getCurrentUserSafely();
    if (user) {
      throw redirect({ to: "/projetos" });
    } else {
      throw redirect({ to: "/login" });
    }
  },
  component: () => null,
});
