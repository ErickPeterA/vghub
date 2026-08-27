export type PamItemStatus = "not_started" | "in_progress" | "completed";
export type PamStatus = "draft" | "released" | "in_progress" | "completed";

export type PamSuggestion = {
  source: "performance_review";
  source_key: string;
  source_score: number | null;
  improvement_point: string;
  skill_label: string;
};

type ScoreCriterion = {
  key?: unknown;
  label?: unknown;
  collaboratorAverage?: unknown;
  requirementLabel?: unknown;
};

type PerformanceQuestionLike = {
  id: string;
  label?: string;
  groupId?: string;
  groupTitle?: string;
  sectionTitle?: string;
  dynamicSource?: string;
};

const NON_TITLE_VALUES = new Set([
  "diariamente",
  "semanalmente",
  "quinzenalmente",
  "mensalmente",
  "bimensalmente",
  "trimestralmente",
  "semestralmente",
  "anualmente",
  "sempre que necessario",
  "sempre que necessário",
]);

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function numberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeLookup(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function sourceFallbackTitle(question: PerformanceQuestionLike) {
  const labels: Record<string, string> = {
    activities: "Atividade",
    indicators: "Indicador",
    culture_skills: "Habilidade cultural",
    role_skills: "Habilidade do cargo",
    behavior: "Postura e comportamento",
  };
  const base = labels[question.dynamicSource ?? ""] ?? "Ponto de melhoria";
  const suffix = question.groupId?.match(/_(\d+)$/)?.[1];
  return suffix ? `${base} ${suffix}` : base;
}

function isGeneratedOptionValue(value: string) {
  const normalized = normalizeLookup(value).replace(/[_-]+/g, " ");
  const withoutGeneratedId = normalized.replace(/[\s_-]*\d{10,}$/, "").trim();
  return (
    /[\s_-]\d{10,}$/.test(normalized) ||
    /^\d{10,}$/.test(normalized) ||
    NON_TITLE_VALUES.has(normalized) ||
    NON_TITLE_VALUES.has(withoutGeneratedId)
  );
}

function cleanQuestionTitle(value: string, question: PerformanceQuestionLike) {
  const trimmed = value.trim();
  if (!trimmed || isGeneratedOptionValue(trimmed)) return "";
  return trimmed;
}

export function displayPamImprovementPoint(
  value: string | null | undefined,
  fallback = "Ponto de melhoria",
) {
  const title = stringValue(value);
  if (!title) return fallback;
  if (!isGeneratedOptionValue(title)) return title;
  return fallback;
}

function estimateScoreFromAnswer(answer: string) {
  const text = normalizeLookup(answer);
  if (!text || text.includes("nao se aplica")) return null;
  if (
    text.includes("urgentemente") ||
    text.includes("muito") ||
    text.includes("muitas") ||
    text.includes("nao atinjo") ||
    text.includes("nao atinge") ||
    text.includes("menos que 80") ||
    text.includes("abaixo")
  ) {
    return 40;
  }
  if (
    text.includes("regular") ||
    text.includes("pouco") ||
    text.includes("algumas") ||
    text.includes("na maioria das vezes, nao")
  ) {
    return 60;
  }
  if (
    text.includes("bom") ||
    text.includes("atinjo mais que 80") ||
    text.includes("atinjo as metas") ||
    text.includes("dentro do esperado")
  ) {
    return 80;
  }
  if (
    text.includes("otimo") ||
    text.includes("supero") ||
    text.includes("acima") ||
    text.includes("destaco") ||
    text.includes("domina")
  ) {
    return 100;
  }
  return null;
}

function groupTitle(question: PerformanceQuestionLike) {
  return (
    cleanQuestionTitle(stringValue(question.groupTitle), question) ||
    cleanQuestionTitle(stringValue(question.sectionTitle), question) ||
    cleanQuestionTitle(stringValue(question.label), question) ||
    sourceFallbackTitle(question)
  );
}

function dynamicSkillLabel(question: PerformanceQuestionLike) {
  const labels: Record<string, string> = {
    activities: "Atividade",
    indicators: "Indicador",
    culture_skills: "Habilidade cultural",
    role_skills: "Habilidade do cargo",
    behavior: "Postura e comportamento",
  };
  return labels[question.dynamicSource ?? ""] ?? (stringValue(question.sectionTitle) || "Geral");
}

export function isPamItemFilled(item: {
  problem_reason?: string | null;
  improvement_plan?: string | null;
  evidence_plan?: string | null;
}) {
  return Boolean(
    item.problem_reason?.trim() && item.improvement_plan?.trim() && item.evidence_plan?.trim(),
  );
}

export function statusLabel(status?: string | null) {
  const labels: Record<string, string> = {
    draft: "Rascunho",
    released: "Liberado",
    in_progress: "Em andamento",
    completed: "Concluido",
    not_started: "Nao iniciado",
    revoked: "Revogado",
  };
  return labels[status ?? ""] ?? status ?? "-";
}

export function itemStatusLabel(status?: string | null) {
  const labels: Record<string, string> = {
    not_started: "Nao iniciado",
    in_progress: "Em andamento",
    completed: "Concluido",
  };
  return labels[status ?? ""] ?? status ?? "-";
}

export function buildPamSuggestions(
  review: {
    score_summary_snapshot?: unknown;
    questions_snapshot?: unknown;
  },
  collaboratorAnswers?: Record<string, string>,
  threshold = 80,
): PamSuggestion[] {
  const fromSummary = suggestionsFromScoreSummary(review.score_summary_snapshot, threshold);
  if (fromSummary.length) return fromSummary;
  return suggestionsFromAnswers(review.questions_snapshot, collaboratorAnswers ?? {}, threshold);
}

function suggestionsFromScoreSummary(scoreSummary: unknown, threshold: number): PamSuggestion[] {
  const criteria = asRecord(scoreSummary).criteria;
  if (!Array.isArray(criteria)) return [];

  return (criteria as ScoreCriterion[])
    .map((criterion) => {
      const score = numberValue(criterion.collaboratorAverage);
      const label = stringValue(criterion.label);
      const key = stringValue(criterion.key) || label;
      if (score === null || score >= threshold || !label) return null;
      return {
        source: "performance_review" as const,
        source_key: key,
        source_score: score,
        improvement_point: label,
        skill_label: stringValue(criterion.requirementLabel) || label,
      };
    })
    .filter((item): item is PamSuggestion => Boolean(item));
}

function suggestionsFromAnswers(
  questionsSnapshot: unknown,
  answers: Record<string, string>,
  threshold: number,
) {
  if (!Array.isArray(questionsSnapshot)) return [];
  const grouped = new Map<
    string,
    { title: string; skill: string; scores: number[]; order: number; sourceKey: string }
  >();

  (questionsSnapshot as PerformanceQuestionLike[]).forEach((question, index) => {
    const score = estimateScoreFromAnswer(answers[question.id] ?? "");
    if (score === null || score >= threshold) return;
    const key = question.groupId || question.id;
    const current = grouped.get(key);
    if (current) {
      current.scores.push(score);
      return;
    }
    grouped.set(key, {
      title: groupTitle(question),
      skill: dynamicSkillLabel(question),
      scores: [score],
      order: index,
      sourceKey: key,
    });
  });

  return Array.from(grouped.values())
    .sort((a, b) => a.order - b.order)
    .map((item) => ({
      source: "performance_review" as const,
      source_key: item.sourceKey,
      source_score: Math.round(
        (item.scores.reduce((sum, score) => sum + score, 0) / item.scores.length) * 100,
      ) / 100,
      improvement_point: item.title,
      skill_label: item.skill,
    }));
}
