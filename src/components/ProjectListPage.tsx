import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FolderKanban, Menu, Plus, Power, PowerOff } from "lucide-react";
import { toast } from "sonner";
import { useCurrentUser } from "@/hooks/use-current-user";
import { apiJson } from "@/lib/api";

type Projeto = {
  id: string;
  nome: string;
  empresa: string | null;
  status: string;
  responsavel_id: string | null;
  responsavel_nome: string | null;
  created_at: string;
};

export function ProjectListPage() {
  const { isAdmin } = useCurrentUser();
  const [rows, setRows] = useState<Projeto[]>([]);
  const [loading, setLoading] = useState(true);
  const [responsaveis, setResponsaveis] = useState<Record<string, string>>({});
  const [showDisabled, setShowDisabled] = useState(false);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      const payload = await apiJson<{ ok: boolean; projects: Projeto[] }>("/api/projects");
      const projs = payload.projects ?? [];
      setRows(projs);
      const map: Record<string, string> = {};
      projs.forEach((project) => {
        if (project.responsavel_id && project.responsavel_nome) {
          map[project.responsavel_id] = project.responsavel_nome;
        }
      });
      setResponsaveis(map);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao carregar projetos");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const alternarStatus = async (id: string, atual: string, nome: string) => {
    const novo = atual === "desativado" ? "ativo" : "desativado";
    if (novo === "desativado") {
      const confirmado = confirm(
        `Desativar o projeto "${nome}"?\n\nOs dados continuam salvos, mas todos os usuarios vinculados perdem acesso, exceto GPs e administradores.`,
      );
      if (!confirmado) return;
    }

    try {
      await apiJson<{ ok: boolean }>(`/api/projects/${id}`, {
        method: "PATCH",
        body: { status: novo },
      });
      toast.success(novo === "desativado" ? "Projeto desativado" : "Projeto ativado");
      void load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao atualizar projeto");
    }
  };

  const activeProjects = rows.filter((p) => p.status !== "desativado");
  const disabledProjects = rows.filter((p) => p.status === "desativado");

  const renderProjectCard = (p: Projeto) => (
    <div key={p.id} className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-2">
        <Link
          to="/projetos/$projectId/descricao-cargo"
          params={{ projectId: p.id }}
          className="flex-1"
        >
          <h3 className="font-display text-xl leading-tight hover:text-accent">{p.nome}</h3>
          {p.empresa && <p className="mt-1 text-sm text-muted-foreground">{p.empresa}</p>}
        </Link>
        <span
          className={`rounded-full px-2 py-0.5 text-xs ${p.status === "ativo" ? "bg-accent/20 text-accent" : "bg-muted text-muted-foreground"}`}
        >
          {p.status === "ativo" ? "Ativo" : "Desativado"}
        </span>
      </div>
      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {p.responsavel_id ? (responsaveis[p.responsavel_id] ?? "-") : "Sem responsavel"}
        </span>
        <span>{new Date(p.created_at).toLocaleDateString("pt-BR")}</span>
      </div>
      {isAdmin && (
        <div className="mt-4 flex gap-2 border-t border-border pt-3">
          <button
            onClick={() =>
              navigate({ to: "/projetos/$projectId/descricao-cargo", params: { projectId: p.id } })
            }
            className="flex-1 rounded-md bg-[#173c78] px-3 py-1.5 text-xs text-white hover:bg-[#042558] cursor-pointer"
          >
            Abrir
          </button>
          <button
            onClick={() => alternarStatus(p.id, p.status, p.nome)}
            className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
              p.status === "ativo"
                ? "border-border text-muted-foreground hover:border-red-500 hover:bg-red-50 hover:text-red-600"
                : "border-accent/40 text-accent hover:bg-accent/10"
            }`}
            title={
              p.status === "ativo"
                ? "Desativar projeto (bloqueia acesso, mantem os dados)"
                : "Ativar projeto (libera o acesso novamente)"
            }
          >
            {p.status === "ativo" ? (
              <PowerOff className="h-3 w-3" />
            ) : (
              <Power className="h-3 w-3" />
            )}
          </button>
        </div>
      )}
    </div>
  );

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <div className="mb-10 flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Workspace</p>
          <h1 className="mt-2 font-display text-5xl">Projetos</h1>
        </div>
        {isAdmin && (
          <Link
            to="/projetos/novo"
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Novo projeto
          </Link>
        )}
      </div>

      {loading ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center text-sm text-muted-foreground">
          Carregando...
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-16 text-center">
          <FolderKanban className="mx-auto h-10 w-10 text-muted-foreground" strokeWidth={1.2} />
          <h3 className="mt-4 font-display text-2xl">Nenhum projeto disponivel</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {isAdmin
              ? "Crie o primeiro projeto."
              : "Voce ainda nao esta vinculado a nenhum projeto. Fale com o administrador."}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {activeProjects.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {activeProjects.map(renderProjectCard)}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
              <FolderKanban className="mx-auto h-8 w-8 text-muted-foreground" strokeWidth={1.2} />
              <h3 className="mt-3 font-display text-xl">Nenhum projeto ativo</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Os projetos desativados ficam no menu abaixo.
              </p>
            </div>
          )}

          {disabledProjects.length > 0 && (
            <section className="border-t border-border pt-5">
              <button
                type="button"
                onClick={() => setShowDisabled((value) => !value)}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                aria-expanded={showDisabled}
              >
                <Menu className="h-4 w-4" />
                Projetos desativados ({disabledProjects.length})
              </button>

              {showDisabled && (
                <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {disabledProjects.map(renderProjectCard)}
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </main>
  );
}
