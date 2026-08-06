import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Save, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

type CriterionKey =
  | "instruction"
  | "experience"
  | "activities"
  | "indicators"
  | "cultural_skills"
  | "role_skills"
  | "behavior";

type Career = { key: string; label: string };
type WeightMap = Record<string, Record<CriterionKey, string>>;
type ScoreRule = {
  id: string;
  label: string;
  score: string;
  notApplicable?: boolean;
};
type PerformanceQuestion = {
  id: string;
  type: "text" | "textarea" | "select";
  active?: boolean;
  options?: string[];
  leaderOptions?: string[];
  sectionTitle?: string;
  dynamicSource?: "activities" | "indicators" | "culture_skills" | "role_skills" | "behavior";
};
type WeightRow = {
  career_key: string;
  career_label: string;
  weights: Record<string, number> | null;
};
type ScoreRow = {
  criterion_key: CriterionKey;
  scoring_schema: Array<{
    id?: string;
    label?: string;
    score?: number | null;
    notApplicable?: boolean;
  }> | null;
};

const CRITERIA: Array<{ key: CriterionKey; label: string }> = [
  { key: "instruction", label: "Instrução" },
  { key: "experience", label: "Experiência" },
  { key: "activities", label: "Atividades" },
  { key: "indicators", label: "Indicadores" },
  { key: "cultural_skills", label: "Habilidades Culturais" },
  { key: "role_skills", label: "Habilidades do Cargo" },
  { key: "behavior", label: "Postura e Comportamento" },
];

const DEFAULT_WEIGHTS: Record<CriterionKey, string> = {
  instruction: "10",
  experience: "5",
  activities: "30",
  indicators: "10",
  cultural_skills: "30",
  role_skills: "10",
  behavior: "5",
};

const DEFAULT_SCORE_RULES: Record<CriterionKey, ScoreRule[]> = {
  instruction: [
    { id: "two_plus_above", label: "Duas ou mais instruções acima do mínimo", score: "100" },
    { id: "one_above", label: "Uma instrução acima do mínimo", score: "90" },
    { id: "minimum", label: "Atende à instrução mínima", score: "80" },
    { id: "one_below", label: "Uma instrução abaixo do mínimo", score: "64" },
    { id: "two_plus_below", label: "Duas ou mais instruções abaixo do mínimo", score: "0" },
  ],
  experience: [
    { id: "three_above", label: "Três níveis acima do mínimo", score: "100" },
    { id: "two_above", label: "Dois níveis acima do mínimo", score: "93" },
    { id: "one_above", label: "Um nível acima do mínimo", score: "87" },
    { id: "minimum", label: "Atende à experiência mínima", score: "80" },
    { id: "one_below", label: "Um nível abaixo do mínimo", score: "64" },
    { id: "two_below", label: "Dois níveis abaixo do mínimo", score: "57" },
    { id: "three_plus_below", label: "Três ou mais níveis abaixo", score: "0" },
  ],
  activities: [
    {
      id: "master_teaches",
      label: "Domina o processo e ensina outras pessoas",
      score: "100",
    },
    { id: "executes_alone", label: "Executa sem necessidade de auxílio", score: "80" },
    {
      id: "sometimes_needs_help",
      label: "Executa algumas vezes com necessidade de auxílio",
      score: "60",
    },
    {
      id: "often_with_difficulty",
      label: "Executa muitas vezes com dificuldade",
      score: "40",
    },
    { id: "always_needs_help", label: "Sempre necessita de auxílio", score: "0" },
    { id: "not_applicable", label: "Não se aplica", score: "", notApplicable: true },
  ],
  indicators: [],
  cultural_skills: [],
  role_skills: [],
  behavior: [],
};

const inputClass =
  "h-9 rounded-md border-[#042558]/15 bg-white text-sm text-[#042558] focus-visible:ring-[#042558]/30";

function normalizeLookup(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function careerKey(value: string) {
  const normalized = normalizeLookup(value)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || "geral";
}

function formatPercent(value: number) {
  return Number.isInteger(value)
    ? `${value}%`
    : `${value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}%`;
}

function toNumber(value: string | number | null | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (!value) return 0;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function toScoreValue(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "";
  return String(value);
}

function isNotApplicable(label: string) {
  const normalized = normalizeLookup(label);
  return normalized === "nao se aplica" || normalized === "nao se aplica.";
}

function criterionForQuestion(question: PerformanceQuestion): CriterionKey | null {
  if (question.dynamicSource === "activities") return "activities";
  if (question.dynamicSource === "indicators") return "indicators";
  if (question.dynamicSource === "culture_skills") return "cultural_skills";
  if (question.dynamicSource === "role_skills") return "role_skills";
  if (question.dynamicSource === "behavior") return "behavior";

  const section = normalizeLookup(question.sectionTitle ?? "");
  if (section.includes("instrucao")) return "instruction";
  if (section.includes("experiencia")) return "experience";
  if (section.includes("atividade")) return "activities";
  if (section.includes("indicador")) return "indicators";
  if (section.includes("cultura")) return "cultural_skills";
  if (section.includes("cargo") && section.includes("habilidade")) return "role_skills";
  if (section.includes("postura") || section.includes("comportamento")) return "behavior";
  return null;
}

function uniqueRulesFromQuestions(questions: PerformanceQuestion[]) {
  const byCriterion: Record<CriterionKey, ScoreRule[]> = {
    instruction: [],
    experience: [],
    activities: [],
    indicators: [],
    cultural_skills: [],
    role_skills: [],
    behavior: [],
  };
  const seen: Record<CriterionKey, Set<string>> = {
    instruction: new Set(),
    experience: new Set(),
    activities: new Set(),
    indicators: new Set(),
    cultural_skills: new Set(),
    role_skills: new Set(),
    behavior: new Set(),
  };

  questions
    .filter((question) => (question.active ?? true) && question.type === "select")
    .forEach((question) => {
      const criterion = criterionForQuestion(question);
      if (!criterion || criterion === "instruction" || criterion === "experience") return;
      [...(question.options ?? []), ...(question.leaderOptions ?? [])].forEach((option) => {
        const label = option.trim();
        const key = normalizeLookup(label);
        if (!label || seen[criterion].has(key)) return;
        seen[criterion].add(key);
        byCriterion[criterion].push({
          id: careerKey(label),
          label,
          score: isNotApplicable(label) ? "" : defaultScoreForOption(label),
          notApplicable: isNotApplicable(label),
        });
      });
    });

  return byCriterion;
}

function defaultScoreForOption(label: string) {
  const normalized = normalizeLookup(label);
  if (
    normalized.includes("destaco") ||
    normalized.includes("domina") ||
    normalized.includes("supero") ||
    normalized.includes("otimo")
  ) {
    return "100";
  }
  if (
    normalized.includes("utilizo") ||
    normalized.includes("executa") ||
    normalized.includes("atinjo as metas") ||
    normalized.includes("atinjo os resultados") ||
    normalized.includes("bom")
  ) {
    return "80";
  }
  if (
    normalized.includes("pouco") ||
    normalized.includes("algumas vezes") ||
    normalized.includes("mais que 80")
  ) {
    return "60";
  }
  if (
    normalized.includes("muito") ||
    normalized.includes("muitas vezes") ||
    normalized.includes("menos que 80") ||
    normalized.includes("regular")
  ) {
    return "40";
  }
  if (
    normalized.includes("urgente") ||
    normalized.includes("sempre necessita") ||
    normalized.includes("nao atinjo") ||
    normalized.includes("ruim")
  ) {
    return "0";
  }
  return "0";
}

function mergeRules(defaults: ScoreRule[], saved?: ScoreRule[]) {
  if (!saved?.length) return defaults;
  const savedById = new Map(saved.map((rule) => [rule.id, rule]));
  const merged = defaults.map((rule) => {
    const existing = savedById.get(rule.id);
    if (!existing) return rule;
    return { ...rule, ...existing, label: rule.label, notApplicable: rule.notApplicable };
  });
  saved.forEach((rule) => {
    if (!merged.some((item) => item.id === rule.id)) merged.push(rule);
  });
  return merged;
}

export function EvaluationWeightsSettings({ projectId }: { projectId: string }) {
  const [careers, setCareers] = useState<Career[]>([]);
  const [weights, setWeights] = useState<WeightMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: field }, { data: descriptions }, { data: savedWeights, error }] =
      await Promise.all([
        supabase
          .from("base_fields")
          .select("base_options(label,value,is_active)")
          .eq("project_id", projectId)
          .eq("field_key", "tipo_carreira")
          .maybeSingle(),
        supabase
          .from("descricoes_cargo")
          .select("tipo_carreira,dynamic_values")
          .eq("project_id", projectId),
        supabase
          .from("evaluation_weight_configs")
          .select("career_key,career_label,weights")
          .eq("project_id", projectId),
      ]);

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    const careerMap = new Map<string, Career>();
    const options = (
      (
        field as {
          base_options?: Array<{ label: string; value: string; is_active?: boolean | null }>;
        } | null
      )?.base_options ?? []
    ).filter((option) => option.is_active !== false);

    options.forEach((option) => {
      const key = careerKey(option.value);
      careerMap.set(key, { key, label: option.label });
    });

    (
      (descriptions ?? []) as Array<{
        tipo_carreira?: string | null;
        dynamic_values?: Record<string, unknown> | null;
      }>
    ).forEach((description) => {
      const value =
        description.tipo_carreira?.trim() ||
        (typeof description.dynamic_values?.tipo_carreira === "string"
          ? description.dynamic_values.tipo_carreira.trim()
          : "");
      if (!value) return;
      const option = options.find((item) => item.value === value || item.label === value);
      const key = careerKey(option?.value ?? value);
      careerMap.set(key, { key, label: option?.label ?? value });
    });

    ((savedWeights ?? []) as WeightRow[]).forEach((row) => {
      careerMap.set(row.career_key, { key: row.career_key, label: row.career_label });
    });

    if (careerMap.size === 0) careerMap.set("geral", { key: "geral", label: "Geral" });

    const nextCareers = Array.from(careerMap.values()).sort((a, b) =>
      a.label.localeCompare(b.label, "pt-BR"),
    );
    const savedByCareer = new Map(
      (savedWeights ?? []).map((row) => [row.career_key, row as WeightRow]),
    );
    const nextWeights: WeightMap = {};
    nextCareers.forEach((career) => {
      const saved = savedByCareer.get(career.key)?.weights ?? {};
      nextWeights[career.key] = { ...DEFAULT_WEIGHTS };
      CRITERIA.forEach((criterion) => {
        if (saved[criterion.key] !== undefined) {
          nextWeights[career.key][criterion.key] = String(saved[criterion.key]);
        }
      });
    });

    setCareers(nextCareers);
    setWeights(nextWeights);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = useMemo(() => {
    const next: Record<string, number> = {};
    careers.forEach((career) => {
      next[career.key] = CRITERIA.reduce(
        (sum, criterion) => sum + toNumber(weights[career.key]?.[criterion.key]),
        0,
      );
    });
    return next;
  }, [careers, weights]);

  const canSave = careers.every((career) => Math.abs((totals[career.key] ?? 0) - 100) < 0.01);

  const save = async () => {
    if (!canSave) return toast.error("Ajuste todas as carreiras para totalizar 100%.");
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const payload = careers.map((career) => ({
      project_id: projectId,
      career_key: career.key,
      career_label: career.label,
      weights: CRITERIA.reduce(
        (acc, criterion) => ({
          ...acc,
          [criterion.key]: toNumber(weights[career.key]?.[criterion.key]),
        }),
        {} as Record<CriterionKey, number>,
      ),
      created_by: userData.user?.id ?? null,
    }));
    const { error } = await supabase
      .from("evaluation_weight_configs")
      .upsert(payload as never, { onConflict: "project_id,career_key" });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Pesos salvos");
    await load();
  };

  if (loading) {
    return <p className="text-sm text-[#042558]/60">Carregando pesos...</p>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-[#042558]">Pesos da Avaliação</h2>
        <p className="mt-1 text-sm text-[#042558]/60">
          Defina quanto cada critério representa na nota final da avaliação.
        </p>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-52">Critério</TableHead>
            {careers.map((career) => (
              <TableHead key={career.key} className="min-w-36 text-center">
                {career.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {CRITERIA.map((criterion) => (
            <TableRow key={criterion.key}>
              <TableCell className="font-medium text-[#042558]">{criterion.label}</TableCell>
              {careers.map((career) => (
                <TableCell key={career.key}>
                  <div className="relative">
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={weights[career.key]?.[criterion.key] ?? ""}
                      onChange={(event) =>
                        setWeights((current) => ({
                          ...current,
                          [career.key]: {
                            ...(current[career.key] ?? DEFAULT_WEIGHTS),
                            [criterion.key]: event.target.value,
                          },
                        }))
                      }
                      className={`${inputClass} pr-8 text-right`}
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#042558]/45">
                      %
                    </span>
                  </div>
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow className="hover:bg-transparent">
            <TableCell>Total</TableCell>
            {careers.map((career) => {
              const total = totals[career.key] ?? 0;
              const valid = Math.abs(total - 100) < 0.01;
              const diff = total - 100;
              return (
                <TableCell key={career.key}>
                  <div
                    className={`rounded-lg border px-3 py-2 text-center text-sm font-semibold ${
                      valid
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-red-200 bg-red-50 text-red-700"
                    }`}
                  >
                    <span className="inline-flex items-center justify-center gap-1">
                      {valid ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <AlertCircle className="h-4 w-4" />
                      )}
                      {formatPercent(total)}
                    </span>
                    {!valid && (
                      <p className="mt-1 text-xs font-medium">
                        {diff > 0
                          ? `Excedeu ${formatPercent(diff)}`
                          : `Falta ${formatPercent(Math.abs(diff))}`}
                      </p>
                    )}
                  </div>
                </TableCell>
              );
            })}
          </TableRow>
        </TableFooter>
      </Table>

      <div className="flex justify-end">
        <Button
          onClick={save}
          disabled={!canSave || saving}
          className="bg-[#042558] text-white hover:bg-[#042558]/90"
        >
          <Save className="h-4 w-4" />
          {saving ? "Salvando..." : "Salvar pesos"}
        </Button>
      </div>
    </div>
  );
}

export function CriterionScoringSettings({ projectId }: { projectId: string }) {
  const [selectedCriterion, setSelectedCriterion] = useState<CriterionKey>("instruction");
  const [rulesByCriterion, setRulesByCriterion] =
    useState<Record<CriterionKey, ScoreRule[]>>(DEFAULT_SCORE_RULES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: configs }, { data: savedScores, error }] = await Promise.all([
      supabase
        .from("performance_review_configs")
        .select("questions_schema")
        .eq("project_id", projectId)
        .eq("review_type", "performance")
        .eq("is_active", true)
        .maybeSingle(),
      supabase
        .from("criterion_scoring_configs")
        .select("criterion_key,scoring_schema")
        .eq("project_id", projectId),
    ]);

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    const modelRules = uniqueRulesFromQuestions(
      ((configs as { questions_schema?: PerformanceQuestion[] } | null)?.questions_schema ??
        []) as PerformanceQuestion[],
    );
    const savedByCriterion = new Map(
      ((savedScores ?? []) as ScoreRow[]).map((row) => [
        row.criterion_key,
        (row.scoring_schema ?? []).map((rule) => ({
          id: rule.id ?? careerKey(rule.label ?? ""),
          label: rule.label ?? "",
          score: toScoreValue(rule.score),
          notApplicable: rule.notApplicable,
        })),
      ]),
    );

    const next = {} as Record<CriterionKey, ScoreRule[]>;
    CRITERIA.forEach((criterion) => {
      const defaults =
        criterion.key === "instruction" || criterion.key === "experience"
          ? DEFAULT_SCORE_RULES[criterion.key]
          : modelRules[criterion.key].length
            ? modelRules[criterion.key]
            : DEFAULT_SCORE_RULES[criterion.key];
      next[criterion.key] = mergeRules(defaults, savedByCriterion.get(criterion.key));
    });

    setRulesByCriterion(next);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const rules = rulesByCriterion[selectedCriterion] ?? [];
  const hasInvalidScore = rules.some((rule) => {
    if (rule.notApplicable) return false;
    const value = toNumber(rule.score);
    return rule.score.trim() === "" || value < 0 || value > 100;
  });

  const save = async () => {
    if (hasInvalidScore) return toast.error("Informe pontuações entre 0% e 100%.");
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const payload = {
      project_id: projectId,
      criterion_key: selectedCriterion,
      scoring_schema: rules.map((rule) => ({
        id: rule.id,
        label: rule.label,
        score: rule.notApplicable ? null : toNumber(rule.score),
        notApplicable: rule.notApplicable ?? false,
      })) as Json,
      created_by: userData.user?.id ?? null,
    };
    const { error } = await supabase
      .from("criterion_scoring_configs")
      .upsert(payload as never, { onConflict: "project_id,criterion_key" });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Pontuações salvas");
    await load();
  };

  if (loading) {
    return <p className="text-sm text-[#042558]/60">Carregando pontuações...</p>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-[#042558]">Pontuação dos Critérios</h2>
        <p className="mt-1 text-sm text-[#042558]/60">
          Configure as notas aplicadas conforme o atendimento aos requisitos do cargo.
        </p>
      </div>

      <label className="block max-w-sm">
        <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-[#042558]/55">
          Critério
        </span>
        <select
          value={selectedCriterion}
          onChange={(event) => setSelectedCriterion(event.target.value as CriterionKey)}
          className={`${inputClass} w-full px-3`}
        >
          {CRITERIA.map((criterion) => (
            <option key={criterion.key} value={criterion.key}>
              {criterion.label}
            </option>
          ))}
        </select>
      </label>

      {rules.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#042558]/20 p-8 text-center">
          <SlidersHorizontal className="mx-auto h-6 w-6 text-[#042558]/35" />
          <p className="mt-2 text-sm text-[#042558]/55">
            Nenhuma opção de resposta encontrada no modelo de desempenho para este critério.
          </p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Situação ou resposta</TableHead>
              <TableHead className="w-44 text-right">Pontuação</TableHead>
              <TableHead className="w-48">Regra</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.map((rule) => (
              <TableRow key={rule.id}>
                <TableCell className="font-medium text-[#042558]">{rule.label}</TableCell>
                <TableCell>
                  <div className="relative">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      value={rule.score}
                      disabled={rule.notApplicable}
                      onChange={(event) =>
                        setRulesByCriterion((current) => ({
                          ...current,
                          [selectedCriterion]: current[selectedCriterion].map((item) =>
                            item.id === rule.id ? { ...item, score: event.target.value } : item,
                          ),
                        }))
                      }
                      className={`${inputClass} pr-8 text-right`}
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#042558]/45">
                      %
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <label className="flex items-center gap-2 text-xs text-[#042558]/65">
                    <input
                      type="checkbox"
                      checked={rule.notApplicable ?? false}
                      onChange={(event) =>
                        setRulesByCriterion((current) => ({
                          ...current,
                          [selectedCriterion]: current[selectedCriterion].map((item) =>
                            item.id === rule.id
                              ? {
                                  ...item,
                                  notApplicable: event.target.checked,
                                  score: event.target.checked ? "" : item.score || "0",
                                }
                              : item,
                          ),
                        }))
                      }
                      className="h-4 w-4 rounded border-[#042558]/20"
                    />
                    Não contabilizar
                  </label>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <div className="flex justify-end">
        <Button
          onClick={save}
          disabled={hasInvalidScore || saving}
          className="bg-[#042558] text-white hover:bg-[#042558]/90"
        >
          <Save className="h-4 w-4" />
          {saving ? "Salvando..." : "Salvar pontuações"}
        </Button>
      </div>
    </div>
  );
}
