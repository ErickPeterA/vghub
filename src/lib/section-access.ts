export type SectionPlan = "free" | "starter" | "pro" | "enterprise";

export const SECTION_PLAN_LABELS: Record<SectionPlan, string> = {
  free: "Free",
  starter: "Starter",
  pro: "Pro",
  enterprise: "Enterprise",
};

const SECTION_PLAN_ACCESS: Record<string, SectionPlan[]> = {
  "Cabeçalho": ["free", "starter", "pro", "enterprise"],
  Instrução: ["free", "starter", "pro", "enterprise"],
  Experiência: ["starter", "pro", "enterprise"],
  Conhecimento: ["starter", "pro", "enterprise"],
  Atividades: ["starter", "pro", "enterprise"],
  Indicadores: ["pro", "enterprise"],
  "Habilidades do Cargo": ["pro", "enterprise"],
  "Habilidades Culturais": ["pro", "enterprise"],
  "Postura & Comportamento": ["pro", "enterprise"],
};

export function getCurrentUserPlan(): SectionPlan {
  if (typeof window === "undefined") return "pro";

  const stored = window.localStorage.getItem("vghub_plan");
  if (stored === "free" || stored === "starter" || stored === "pro" || stored === "enterprise") {
    return stored;
  }

  const queryPlan = new URLSearchParams(window.location.search).get("plan");
  if (queryPlan === "free" || queryPlan === "starter" || queryPlan === "pro" || queryPlan === "enterprise") {
    return queryPlan;
  }

  const envPlan = import.meta.env.VITE_APP_PLAN;
  if (envPlan === "free" || envPlan === "starter" || envPlan === "pro" || envPlan === "enterprise") {
    return envPlan;
  }

  return "pro";
}

export function canAccessSection(sectionKey: string, plan: SectionPlan = getCurrentUserPlan()) {
  return (SECTION_PLAN_ACCESS[sectionKey] ?? ["free", "starter", "pro", "enterprise"]).includes(plan);
}
