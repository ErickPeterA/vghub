import { createFileRoute } from "@tanstack/react-router";
import {
  GraduationCap,
  Briefcase,
  BookOpen,
  ListChecks,
  Target,
  Sparkles,
  Heart,
  Users,
  ArrowUpRight,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Estrutura de Descrição de Cargos" },
      {
        name: "description",
        content:
          "Plataforma estruturada para mapear cargos, competências e indicadores.",
      },
    ],
  }),
  component: Index,
});

const sections = [
  {
    icon: Users,
    label: "01",
    title: "Cabeçalho do Cargo",
    desc: "Unidade, departamento, nivelamento, superior imediato e status.",
    fields: ["Cargo", "Departamento", "Nivelamento", "Superior", "Status"],
  },
  {
    icon: GraduationCap,
    label: "02",
    title: "Instrução",
    desc: "Requisitos de formação acadêmica e áreas de estudo desejadas.",
    fields: ["Requisito 1", "Nível", "Área", "Requisito 2"],
  },
  {
    icon: Briefcase,
    label: "03",
    title: "Experiência",
    desc: "Tempo mínimo, tipo de experiência e área de atuação prévia.",
    fields: ["Tipo", "Tempo mínimo", "Área específica"],
  },
  {
    icon: BookOpen,
    label: "04",
    title: "Conhecimento",
    desc: "Conhecimentos técnicos e seus respectivos níveis de proficiência.",
    fields: ["Conhecimento", "Descrição", "Nível"],
  },
  {
    icon: ListChecks,
    label: "05",
    title: "Atividades",
    desc: "Macroprocessos, atividades regulares e periodicidade de execução.",
    fields: ["Macroprocesso", "Atividade", "Periodicidade"],
  },
  {
    icon: Target,
    label: "06",
    title: "Indicadores",
    desc: "KPIs vinculados ao cargo e metas mensuráveis de performance.",
    fields: ["Indicador", "Meta"],
  },
  {
    icon: Sparkles,
    label: "07",
    title: "Habilidades",
    desc: "Competências específicas do cargo e alinhamento cultural.",
    fields: ["Hab. Cargo", "Hab. Cultural", "Descrição"],
  },
  {
    icon: Heart,
    label: "08",
    title: "Postura & Comportamento",
    desc: "Atitudes esperadas e comportamentos alinhados aos valores.",
    fields: ["Postura", "Comportamento"],
  },
];

function Index() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="border-b border-border/60">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-accent" />
            <span className="font-display text-xl">Estrutura DC</span>
          </div>
          <div className="hidden gap-8 text-sm text-muted-foreground md:flex">
            <a href="#estrutura" className="hover:text-foreground">Estrutura</a>
            <a href="#fluxo" className="hover:text-foreground">Fluxo</a>
            <a href="#sobre" className="hover:text-foreground">Sobre</a>
          </div>
          <button className="rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground transition hover:opacity-90">
            Começar
          </button>
        </div>
      </nav>

      {/* Hero */}
      <header className="mx-auto max-w-7xl px-6 pt-24 pb-20">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs uppercase tracking-widest text-muted-foreground">
              <span className="h-1 w-1 rounded-full bg-accent" />
              Base padrão · v1.0
            </div>
            <h1 className="font-display text-6xl leading-[1.02] md:text-8xl">
              Uma estrutura
              <br />
              <em className="text-accent">viva</em> para descrever
              <br />
              cargos com clareza.
            </h1>
            <p className="mt-8 max-w-xl text-lg text-muted-foreground">
              Oito blocos conectados que organizam tudo o que importa em um
              cargo — da instrução exigida aos indicadores de sucesso.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <a
                href="#estrutura"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm text-primary-foreground transition hover:opacity-90"
              >
                Ver estrutura <ArrowUpRight className="h-4 w-4" />
              </a>
              <a
                href="#fluxo"
                className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-3 text-sm hover:bg-secondary"
              >
                Como funciona
              </a>
            </div>
          </div>
          <div className="lg:col-span-4">
            <div className="sticky top-6 rounded-2xl border border-border bg-card p-6">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                Sumário
              </p>
              <ul className="mt-4 space-y-3 text-sm">
                {sections.map((s) => (
                  <li key={s.label} className="flex items-center justify-between border-b border-border/60 pb-2 last:border-0">
                    <span className="text-muted-foreground">{s.label}</span>
                    <span>{s.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </header>

      {/* Estrutura */}
      <section id="estrutura" className="border-t border-border/60 bg-secondary/30">
        <div className="mx-auto max-w-7xl px-6 py-24">
          <div className="mb-16 flex items-end justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                Os oito blocos
              </p>
              <h2 className="mt-3 font-display text-5xl md:text-6xl">
                Estrutura completa
              </h2>
            </div>
            <p className="hidden max-w-sm text-sm text-muted-foreground md:block">
              Cada bloco representa uma seção da descrição. Combinados, formam
              um retrato fiel do papel na organização.
            </p>
          </div>

          <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-2 lg:grid-cols-4">
            {sections.map((s) => (
              <article
                key={s.label}
                className="group relative flex flex-col gap-4 bg-card p-7 transition hover:bg-background"
              >
                <div className="flex items-center justify-between">
                  <s.icon className="h-6 w-6 text-accent" strokeWidth={1.5} />
                  <span className="font-display text-2xl text-muted-foreground">
                    {s.label}
                  </span>
                </div>
                <h3 className="font-display text-2xl">{s.title}</h3>
                <p className="text-sm text-muted-foreground">{s.desc}</p>
                <ul className="mt-auto flex flex-wrap gap-1.5 pt-4">
                  {s.fields.map((f) => (
                    <li
                      key={f}
                      className="rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground"
                    >
                      {f}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Fluxo */}
      <section id="fluxo" className="mx-auto max-w-7xl px-6 py-24">
        <div className="grid gap-16 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Fluxo de preenchimento
            </p>
            <h2 className="mt-3 font-display text-5xl md:text-6xl">
              Do esboço à versão final.
            </h2>
            <p className="mt-6 text-muted-foreground">
              Quatro etapas garantem que cada descrição passe por
              estruturação, validação e publicação consistentes.
            </p>
          </div>
          <div className="lg:col-span-7">
            {[
              ["Mapear", "Levantar dados básicos do cargo e seu contexto."],
              ["Estruturar", "Preencher os oito blocos com clareza e padronização."],
              ["Validar", "Revisão com gestor imediato e área de Pessoas."],
              ["Publicar", "Versão oficial com data, status e histórico de revisões."],
            ].map(([title, desc], i) => (
              <div
                key={title}
                className="flex gap-6 border-b border-border py-6 last:border-0"
              >
                <span className="font-display text-3xl text-accent">
                  0{i + 1}
                </span>
                <div>
                  <h3 className="font-display text-2xl">{title}</h3>
                  <p className="mt-1 text-muted-foreground">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="sobre" className="border-t border-border/60">
        <div className="mx-auto max-w-7xl px-6 py-24">
          <div className="rounded-3xl bg-primary p-12 text-primary-foreground md:p-20">
            <h2 className="max-w-3xl font-display text-5xl md:text-6xl">
              Comece com uma base sólida.
            </h2>
            <p className="mt-6 max-w-xl text-primary-foreground/70">
              Uma estrutura padrão pronta para ser adaptada à realidade da sua
              organização — sem reinventar a roda.
            </p>
            <button className="mt-10 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm text-accent-foreground transition hover:opacity-90">
              Explorar template <ArrowUpRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-8 text-sm text-muted-foreground">
          <span>© 2026 Estrutura DC</span>
          <span>Modelo padrão · sem dados reais</span>
        </div>
      </footer>
    </div>
  );
}
