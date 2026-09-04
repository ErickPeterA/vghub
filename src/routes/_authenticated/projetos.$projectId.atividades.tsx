import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ActivityCompilationPanel, ActivityLinksPanel } from "@/components/ActivityLinksPanel";
import { apiJson } from "@/lib/api";
import { useCurrentUser } from "@/hooks/use-current-user";

export const Route = createFileRoute("/_authenticated/projetos/$projectId/atividades")({
  component: AtividadesPage,
});

function AtividadesPage() {
  const { projectId } = Route.useParams();
  const { user, isAdmin } = useCurrentUser();
  const [tab, setTab] = useState<"links" | "compilation">("links");
  const [unreviewed, setUnreviewed] = useState(0);
  const [canManage, setCanManage] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      setCanManage(true);
      return;
    }
    if (!user) {
      setCanManage(false);
      return;
    }
    let cancelled = false;
    apiJson<{ ok: boolean; projectRole: string | null }>(`/api/projects/${projectId}/navigation`)
      .then(({ projectRole }) => {
        if (!cancelled) setCanManage(projectRole === "gp" || projectRole === "admin");
      })
      .catch(() => {
        if (!cancelled) setCanManage(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin, projectId, user]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#042558]/5 via-white to-[#042558]/5 px-6 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 rounded-2xl border border-[#042558]/10 bg-white/80 p-6 shadow-sm backdrop-blur-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#042558]/50">
              Atividades
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#042558]">
              Coleta de atividades
            </h1>
            <p className="mt-1 text-sm text-[#042558]/60">
              Preencha o cabeçalho, gere links para colaboradores e receba as respostas.
            </p>
          </div>
        </div>

        <div className="mb-8 border-b border-[#042558]/10">
          <div className="flex gap-8">
            <TabBtn active={tab === "links"} onClick={() => setTab("links")}>
              Links e Respostas
              {unreviewed > 0 && (
                <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[10px] font-bold text-white">
                  {unreviewed}
                </span>
              )}
            </TabBtn>
            {canManage && (
              <TabBtn active={tab === "compilation"} onClick={() => setTab("compilation")}>
                Concluídos
              </TabBtn>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-[#042558]/10 bg-white/60 p-0.5 shadow-sm backdrop-blur-sm">
          <div className="rounded-2xl bg-white/40 p-6">
            {!canManage ? (
              <div className="rounded-xl border border-dashed border-[#042558]/20 p-8 text-center text-sm text-[#042558]/50">
                Apenas GP e administradores podem gerar links de atividades.
              </div>
            ) : tab === "compilation" ? (
              <ActivityCompilationPanel projectId={projectId} />
            ) : (
              <ActivityLinksPanel projectId={projectId} onUnreviewedChange={setUnreviewed} />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative pb-3 text-sm font-medium transition-all duration-200 ${
        active ? "text-[#042558]" : "text-[#042558]/40 hover:text-[#042558]/70"
      }`}
    >
      {children}
      {active && (
        <span className="absolute bottom-0 left-0 h-0.5 w-full rounded-full bg-[#042558]" />
      )}
    </button>
  );
}
