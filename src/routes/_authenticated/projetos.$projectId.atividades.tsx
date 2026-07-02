import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ActivityConfigManager } from "@/components/ActivityConfigManager";
import { ActivityLinksPanel } from "@/components/ActivityLinksPanel";

export const Route = createFileRoute("/_authenticated/projetos/$projectId/atividades")({
  component: AtividadesPage,
});

function AtividadesPage() {
  const { projectId } = Route.useParams();
  const [tab, setTab] = useState<"config" | "links">("links");
  const [unreviewed, setUnreviewed] = useState(0);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-widest text-[#042558]/60">Atividades</p>
        <h1 className="mt-2 font-display text-4xl text-[#042558]">Coleta de atividades</h1>
        <p className="mt-1 text-sm text-[#042558]/60">Configure o formulário, gere links para colaboradores e receba as respostas.</p>
      </div>

      <div className="mb-6 flex gap-2 border-b border-[#042558]/10">
        <TabBtn active={tab === "links"} onClick={() => setTab("links")}>
          Links & Respostas {unreviewed > 0 && <span className="ml-1 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{unreviewed}</span>}
        </TabBtn>
        <TabBtn active={tab === "config"} onClick={() => setTab("config")}>Configuração do formulário</TabBtn>
      </div>

      {tab === "config" ? <ActivityConfigManager projectId={projectId} /> : <ActivityLinksPanel projectId={projectId} onUnreviewedChange={setUnreviewed} />}
    </main>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`px-4 py-2 text-sm font-medium transition ${active ? "border-b-2 border-[#042558] text-[#042558]" : "text-[#042558]/50 hover:text-[#042558]"}`}>
      {children}
    </button>
  );
}
