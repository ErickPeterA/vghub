import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const criteria = [
  ["instruction", "Instrução"],
  ["experience", "Experiência"],
  ["activities", "Atividades"],
  ["indicators", "Indicadores"],
  ["culture_skills", "Habilidades Culturais"],
  ["role_skills", "Habilidades do Cargo"],
  ["behavior", "Postura e Comportamento"],
] as const;

type CriterionKey = (typeof criteria)[number][0];
type Career = { key: string; label: string };
type WeightMap = Record<CriterionKey, number>;
type Rule = { key: string; label: string; score: number | null };
type ScoringMap = Record<CriterionKey, Rule[]>;

const newWeights = () => Object.fromEntries(criteria.map(([key]) => [key, 0])) as WeightMap;
const comparisonRules = (): Rule[] => [
  { key: "above", label: "Acima do mínimo exigido", score: 100 },
  { key: "meets", label: "Atende ao mínimo exigido", score: 80 },
  { key: "one_below", label: "Um nível abaixo do mínimo", score: 64 },
  { key: "two_below", label: "Dois níveis abaixo do mínimo", score: 48 },
  { key: "three_below", label: "Três ou mais níveis abaixo", score: 32 },
  { key: "not_applicable", label: "Não se aplica", score: null },
];
const responseRules = (): Rule[] => [
  { key: "excellent", label: "Supera / destaque", score: 100 },
  { key: "meets", label: "Atende plenamente", score: 80 },
  { key: "partial", label: "Atende parcialmente", score: 60 },
  { key: "low", label: "Abaixo do esperado", score: 40 },
  { key: "critical", label: "Não atende / crítico", score: 20 },
  { key: "not_applicable", label: "Não se aplica", score: null },
];
const newScoring = () =>
  Object.fromEntries(
    criteria.map(([key]) => [key, key === "instruction" || key === "experience" ? comparisonRules() : responseRules()]),
  ) as ScoringMap;

function useCareers(projectId: string) {
  const [careers, setCareers] = useState<Career[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    supabase
      .from("base_fields")
      .select("base_options(label,value,is_active,display_order)")
      .eq("project_id", projectId)
      .eq("field_key", "tipo_carreira")
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) toast.error(error.message);
        const options = ((data?.base_options ?? []) as Array<{ label: string; value: string; is_active: boolean; display_order: number }>)
          .filter((option) => option.is_active)
          .sort((a, b) => a.display_order - b.display_order)
          .map((option) => ({ key: option.value, label: option.label }));
        setCareers(options);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [projectId]);
  return { careers, loading };
}

function CareerSelect({ careers, value, onChange }: { careers: Career[]; value: string; onChange: (value: string) => void }) {
  return (
    <div className="w-full max-w-xs">
      <label className="mb-1.5 block text-xs font-semibold uppercase text-[#042558]/55">Carreira</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="border-[#042558]/20 bg-white text-[#042558]"><SelectValue placeholder="Selecione" /></SelectTrigger>
        <SelectContent>{careers.map((career) => <SelectItem key={career.key} value={career.key}>{career.label}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}

function EmptyCareers() {
  return <div className="rounded-lg border border-dashed border-[#042558]/20 bg-white/50 p-8 text-center text-sm text-[#042558]/60">Cadastre as opções do campo “Tipo de carreira” no Modelo de Descrição de Cargo.</div>;
}

export function EvaluationWeightsConfig({ projectId }: { projectId: string }) {
  const { careers, loading: careersLoading } = useCareers(projectId);
  const [careerKey, setCareerKey] = useState("");
  const [weights, setWeights] = useState<WeightMap>(newWeights);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!careers.some((career) => career.key === careerKey)) setCareerKey(careers[0]?.key ?? "");
  }, [careerKey, careers]);
  const load = useCallback(async () => {
    if (!careerKey) return;
    setLoading(true);
    const { data, error } = await supabase.from("evaluation_weights").select("criterion_key,weight_percent").eq("project_id", projectId).eq("career_key", careerKey);
    if (error) toast.error(error.message);
    const next = newWeights();
    (data ?? []).forEach((row) => {
      if (criteria.some(([key]) => key === row.criterion_key)) next[row.criterion_key as CriterionKey] = Number(row.weight_percent);
    });
    setWeights(next);
    setLoading(false);
  }, [careerKey, projectId]);
  useEffect(() => { void load(); }, [load]);
  const total = useMemo(() => Object.values(weights).reduce((sum, value) => sum + value, 0), [weights]);
  const save = async () => {
    const career = careers.find((item) => item.key === careerKey);
    if (!career || total !== 100) return toast.error("A soma dos pesos deve ser exatamente 100%.");
    setSaving(true);
    const { error } = await supabase.from("evaluation_weights").upsert(criteria.map(([key]) => ({ project_id: projectId, career_key: career.key, career_label: career.label, criterion_key: key, weight_percent: weights[key] })), { onConflict: "project_id,career_key,criterion_key" });
    setSaving(false);
    error ? toast.error(error.message) : toast.success("Pesos salvos.");
  };
  if (careersLoading) return <p className="py-8 text-sm text-[#042558]/55">Carregando carreiras...</p>;
  if (!careers.length) return <EmptyCareers />;
  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-lg font-bold text-[#042558]">Pesos da Avaliação</h2><p className="mt-1 text-sm text-[#042558]/60">Distribua a importância dos critérios para cada carreira.</p></div><CareerSelect careers={careers} value={careerKey} onChange={setCareerKey} /></div>
      <div className="overflow-hidden rounded-lg border border-[#042558]/10 bg-white/70"><Table><TableHeader><TableRow><TableHead>Critério</TableHead><TableHead className="w-40 text-right">Peso</TableHead></TableRow></TableHeader><TableBody>
        {criteria.map(([key, label]) => <TableRow key={key}><TableCell className="font-medium text-[#042558]">{label}</TableCell><TableCell><div className="flex items-center justify-end gap-2"><Input type="number" min={0} max={100} value={weights[key]} disabled={loading} onChange={(event) => setWeights((current) => ({ ...current, [key]: Math.min(100, Math.max(0, Number(event.target.value) || 0)) }))} className="w-24 text-right" /><span className="text-sm text-[#042558]/50">%</span></div></TableCell></TableRow>)}
        <TableRow className={total === 100 ? "bg-emerald-50" : "bg-red-50"}><TableCell className="font-bold">Total</TableCell><TableCell className="text-right font-bold">{total}%</TableCell></TableRow>
      </TableBody></Table></div>
      <div className="flex items-center justify-between gap-3"><p className={`flex items-center gap-1.5 text-xs ${total === 100 ? "text-emerald-700" : "text-red-700"}`}>{total === 100 && <CheckCircle2 className="h-4 w-4" />}{total === 100 ? "Distribuição válida" : `Ajuste ${Math.abs(100 - total)}% para completar 100%.`}</p><Button onClick={save} disabled={saving || loading || total !== 100}><Save className="h-4 w-4" />{saving ? "Salvando..." : "Salvar pesos"}</Button></div>
    </section>
  );
}

export function CriterionScoringConfig({ projectId }: { projectId: string }) {
  const { careers, loading: careersLoading } = useCareers(projectId);
  const [careerKey, setCareerKey] = useState("");
  const [scoring, setScoring] = useState<ScoringMap>(newScoring);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!careers.some((career) => career.key === careerKey)) setCareerKey(careers[0]?.key ?? "");
  }, [careerKey, careers]);
  const load = useCallback(async () => {
    if (!careerKey) return;
    setLoading(true);
    const { data, error } = await supabase.from("criterion_scoring_configs").select("criterion_key,rules").eq("project_id", projectId).eq("career_key", careerKey);
    if (error) toast.error(error.message);
    const next = newScoring();
    (data ?? []).forEach((row) => {
      if (criteria.some(([key]) => key === row.criterion_key) && Array.isArray(row.rules)) next[row.criterion_key as CriterionKey] = row.rules as unknown as Rule[];
    });
    setScoring(next);
    setLoading(false);
  }, [careerKey, projectId]);
  useEffect(() => { void load(); }, [load]);
  const save = async () => {
    const career = careers.find((item) => item.key === careerKey);
    if (!career) return;
    setSaving(true);
    const { error } = await supabase.from("criterion_scoring_configs").upsert(criteria.map(([key]) => ({ project_id: projectId, career_key: career.key, career_label: career.label, criterion_key: key, rules: scoring[key] })), { onConflict: "project_id,career_key,criterion_key" });
    setSaving(false);
    error ? toast.error(error.message) : toast.success("Pontuações salvas.");
  };
  if (careersLoading) return <p className="py-8 text-sm text-[#042558]/55">Carregando carreiras...</p>;
  if (!careers.length) return <EmptyCareers />;
  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-lg font-bold text-[#042558]">Pontuação dos Critérios</h2><p className="mt-1 text-sm text-[#042558]/60">Defina a nota percentual de cada situação.</p></div><CareerSelect careers={careers} value={careerKey} onChange={setCareerKey} /></div>
      <div className="space-y-4">{criteria.map(([key, label]) => <div key={key} className="overflow-hidden rounded-lg border border-[#042558]/10 bg-white/70"><div className="border-b border-[#042558]/10 bg-[#042558]/5 px-4 py-3"><h3 className="text-sm font-semibold text-[#042558]">{label}</h3>{(key === "instruction" || key === "experience") && <p className="mt-0.5 text-xs text-[#042558]/50">Comparação entre mínimo exigido e nível informado.</p>}</div><Table><TableHeader><TableRow><TableHead>Situação</TableHead><TableHead className="w-40 text-right">Pontuação</TableHead></TableRow></TableHeader><TableBody>
        {scoring[key].map((rule, index) => <TableRow key={rule.key}><TableCell>{rule.label}</TableCell><TableCell>{rule.score === null ? <p className="text-right text-xs font-medium text-[#042558]/50">Não compõe a nota</p> : <div className="flex items-center justify-end gap-2"><Input type="number" min={0} max={100} value={rule.score} disabled={loading} onChange={(event) => setScoring((current) => ({ ...current, [key]: current[key].map((item, itemIndex) => itemIndex === index ? { ...item, score: Math.min(100, Math.max(0, Number(event.target.value) || 0)) } : item) }))} className="w-24 text-right" /><span className="text-sm text-[#042558]/50">%</span></div>}</TableCell></TableRow>)}
      </TableBody></Table></div>)}</div>
      <div className="flex justify-end"><Button onClick={save} disabled={saving || loading}><Save className="h-4 w-4" />{saving ? "Salvando..." : "Salvar pontuações"}</Button></div>
    </section>
  );
}