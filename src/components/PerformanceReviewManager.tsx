import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  History,
  MessageSquare,
  Plus,
  RotateCcw,
  Save,
  Send,
  Settings,
  SplitSquareVertical,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useCurrentUser } from "@/hooks/use-current-user";

type FieldType = "text" | "textarea" | "select";
type ParticipantType = "collaborator" | "leader";
type ParticipantStatus = "not_sent" | "sent" | "accessed" | "in_progress" | "answered";
type ReviewStatus = "draft" | "waiting_responses" | "ready_for_comparison" | "finalized";
type ReviewType = "experience" | "performance";

export type PerformanceQuestion = {
  id: string;
  label: string;
  leaderLabel?: string;
  type: FieldType;
  required: boolean;
  active?: boolean;
  options?: string[];
  leaderOptions?: string[];
  helpText?: string;
  source?: "activity" | "config" | "job_description";
  sectionTitle?: string;
  groupId?: string;
  groupTitle?: string;
  dynamicSource?: "activities" | "indicators" | "culture_skills" | "role_skills" | "behavior";
  dynamicRole?: "efficiency" | "efficacy" | "result" | "reach" | "fit" | "rating";
};

type PositionRow = { id: string; nome: string; parent_id: string | null };
type DcRow = {
  id: string;
  project_id: string;
  organization_position_id: string | null;
  cargo: string | null;
  superior_imediato: string | null;
  atividades: Array<Record<string, unknown>> | null;
  indicadores?: Array<Record<string, unknown>> | null;
  habilidades_cargo?: Array<Record<string, unknown>> | null;
  habilidades_culturais?: Array<Record<string, unknown>> | null;
  postura?: Array<Record<string, unknown>> | null;
  [key: string]: unknown;
};
type BaseFieldRow = {
  field_key: string;
  label: string;
  section: string;
  base_options?: Array<{ label: string; value: string; is_active?: boolean | null }>;
};
type PerfEmployeeRow = {
  id: string;
  project_id: string;
  position_id: string;
  area_id: string | null;
  sector_id: string | null;
  superior_imediato_id: string | null;
  nome: string;
  admission_date: string;
  last_performance_review_date: string | null;
};
type ConfigRow = {
  id: string;
  project_id: string | null;
  name: string | null;
  period_days: number | null;
  review_type?: ReviewType | null;
  questions_schema: PerformanceQuestion[];
  is_active: boolean;
};
type ParticipantRow = {
  id: string;
  review_id: string;
  participant_type: ParticipantType;
  token: string;
  status: ParticipantStatus;
  expires_at: string;
  sent_at?: string | null;
  response_answers: Record<string, string>;
  submitted_at: string | null;
};
type ReviewRow = {
  id: string;
  project_id: string;
  config_id: string | null;
  employee_id: string | null;
  name: string;
  employee_position_id: string;
  leader_position_id: string;
  job_description_id: string;
  employee_name: string;
  leader_name: string;
  job_title: string;
  period_name: string | null;
  period_days: number | null;
  due_date: string | null;
  review_type?: ReviewType | null;
  activities_snapshot: PerformanceQuestion[];
  questions_snapshot: PerformanceQuestion[];
  status: ReviewStatus;
  finalized_by: string | null;
  finalized_at: string | null;
  created_at: string;
};
type CommentRow = {
  id: string;
  question_key: string;
  author_id: string;
  content: string;
  created_at: string;
};
type HistoryRow = {
  id: string;
  participant_id: string;
  question_key: string;
  previous_answer: string | null;
  new_answer: string | null;
  changed_by: string | null;
  changed_at: string;
};
type AgendaItem = {
  id: string;
  employee: PerfEmployeeRow;
  leader: PerfEmployeeRow | null;
  employeePosition: PositionRow | null;
  description: DcRow | null;
  config: ConfigRow;
  periodDays: number;
  baseDate: string;
  dueDate: string;
  daysUntil: number;
  existingReview: ReviewRow | null;
  reviewType: ReviewType;
};

const EXPERIENCE_LIMIT_DAYS = 90;

const EDUCATION_LEVEL_OPTIONS = [
  "Ensino Fundamental Incompleto",
  "Ensino Fundamental Completo",
  "Ensino Medio Incompleto",
  "Ensino Medio Completo",
  "Ensino Tecnico",
  "Ensino Superior Incompleto",
  "Ensino Superior Completo",
  "Pos-graduacao",
];
const EXPERIENCE_YEARS_OPTIONS = [
  "Menos de 1 ano",
  "1 ano",
  "2 anos",
  "3 anos",
  "4 anos",
  "5 anos",
  "6 a 9 anos",
  "10 ou mais",
];
const ACTIVITY_EFFICIENCY_OPTIONS = [
  "Domina o processo/metodo desta atividade a ponto de tambem ensinar alguem a executa-la",
  "Executa o processo/metodo desta atividade sem necessitar de auxilio.",
  "Algumas vezes executa o processo/metodo desta atividade necessitando de auxilio.",
  "Muitas vezes executa o processo/metodo desta atividade necessitando de auxilio.",
  "Sempre executa o processo/metodo desta atividade necessitando de auxilio.",
  "Nao se aplica.",
];
const ACTIVITY_EFFICACY_OPTIONS = [
  "Supero os resultados propostos.",
  "Atinjo os resultados propostos.",
  "Na maioria das vezes, atinjo os resultados propostos.",
  "Na maioria das vezes, NAO atinjo os resultados propostos.",
  "Nao atinjo os resultados propostos.",
  "Nao se aplica.",
];
const INDICATOR_OPTIONS = [
  "Supero as metas propostas",
  "Atinjo as metas propostas",
  "Atinjo mais que 80% das metas propostas",
  "Atinjo menos que 80% das metas propostas",
  "Nao atinjo",
  "Nao se aplica.",
];
const SKILL_OPTIONS = [
  "Me destaco ao usar esta habilidade nas minhas atividades, sendo exemplo aos demais.",
  "Utilizo na pratica esta habilidade para garantir bons resultados nas minhas atividades",
  "Preciso melhorar UM POUCO na aplicacao desta habilidade, nas minhas atividades.",
  "Preciso melhorar MUITO na aplicacao desta habilidade, nesta atividade.",
  "Preciso melhorar URGENTEMENTE na aplicacao desta habilidade, nas minhas atividades.",
  "Nao se aplica.",
];
const BEHAVIOR_OPTIONS = [
  "Demonstro este comportamento no dia a dia, a ponto de me DESTACAR perante os demais colaboradores.",
  "Demonstro este comportamento no dia a dia.",
  "Preciso MELHORAR neste comportamento em POUCAS situacoes.",
  "Preciso MELHORAR neste comportamento em MUITAS situacoes.",
  "Preciso MELHORAR URGENTEMENTE neste comportamento.",
  "Nao se aplica.",
];

const DEFAULT_PERFORMANCE_QUESTIONS: PerformanceQuestion[] = [
  {
    id: "qualidade_entrega",
    label: "Qualidade das entregas",
    type: "select",
    required: true,
    active: true,
    options: ["Abaixo do esperado", "Dentro do esperado", "Acima do esperado"],
  },
  {
    id: "cumprimento_prazos",
    label: "Cumprimento de prazos",
    type: "select",
    required: true,
    active: true,
    options: ["Abaixo do esperado", "Dentro do esperado", "Acima do esperado"],
  },
  {
    id: "comunicacao",
    label: "Comunicação e colaboração",
    type: "select",
    required: true,
    active: true,
    options: ["Abaixo do esperado", "Dentro do esperado", "Acima do esperado"],
  },
  {
    id: "pontos_fortes",
    label: "Pontos fortes observados",
    type: "textarea",
    required: false,
    active: true,
  },
  {
    id: "pontos_desenvolver",
    label: "Pontos a desenvolver",
    type: "textarea",
    required: false,
    active: true,
  },
];

const DEFAULT_AVDP_QUESTIONS: PerformanceQuestion[] = [
  {
    id: "avdp_instrucao",
    label: "Responda aqui a maior instrucao que o avaliado possui:",
    type: "select",
    required: true,
    active: true,
    options: EDUCATION_LEVEL_OPTIONS,
    sectionTitle: "Instrucao",
  },
  {
    id: "avdp_experiencia",
    label: "Responda aqui a experiencia que o avaliado possui, em anos:",
    type: "select",
    required: true,
    active: true,
    options: EXPERIENCE_YEARS_OPTIONS,
    sectionTitle: "Experiencia",
  },
  {
    id: "avdp_atividade_eficiencia",
    label: "EFICIENCIA - FAZER DA FORMA CORRETA",
    type: "select",
    required: true,
    active: true,
    options: ACTIVITY_EFFICIENCY_OPTIONS,
    sectionTitle: "Avaliacao das atividades",
    dynamicSource: "activities",
    dynamicRole: "efficiency",
  },
  {
    id: "avdp_atividade_eficacia",
    label: "EFICACIA - RESULTADO E QUALIDADE",
    type: "select",
    required: true,
    active: true,
    options: ACTIVITY_EFFICACY_OPTIONS,
    sectionTitle: "Avaliacao das atividades",
    dynamicSource: "activities",
    dynamicRole: "efficacy",
  },
  {
    id: "avdp_indicador_resultado",
    label: "Resultado",
    type: "text",
    required: false,
    active: true,
    sectionTitle: "Indicadores",
    dynamicSource: "indicators",
    dynamicRole: "result",
  },
  {
    id: "avdp_indicador_alcance",
    label: "% de Alcance",
    type: "text",
    required: false,
    active: true,
    sectionTitle: "Indicadores",
    dynamicSource: "indicators",
    dynamicRole: "reach",
  },
  {
    id: "avdp_indicador_enquadramento",
    label: "Enquadramento",
    type: "select",
    required: false,
    active: true,
    options: INDICATOR_OPTIONS,
    sectionTitle: "Indicadores",
    dynamicSource: "indicators",
    dynamicRole: "fit",
  },
  {
    id: "avdp_habilidade_cultura",
    label: "Avaliacao da habilidade",
    type: "select",
    required: true,
    active: true,
    options: SKILL_OPTIONS,
    sectionTitle: "Habilidades da cultura organizacional",
    dynamicSource: "culture_skills",
    dynamicRole: "rating",
  },
  {
    id: "avdp_habilidade_cargo",
    label: "Avaliacao da habilidade",
    type: "select",
    required: true,
    active: true,
    options: SKILL_OPTIONS,
    sectionTitle: "Habilidades especificas do cargo",
    dynamicSource: "role_skills",
    dynamicRole: "rating",
  },
  {
    id: "avdp_postura",
    label: "Avaliacao do comportamento",
    type: "select",
    required: true,
    active: true,
    options: BEHAVIOR_OPTIONS,
    sectionTitle: "Postura e comportamento",
    dynamicSource: "behavior",
    dynamicRole: "rating",
  },
];

const YES_NO_OPTIONS = ["Sim", "Não"];
const RATING_OPTIONS = [
  "Ótimo",
  "Bom",
  "Regular - Justificar o porquê e exemplificar nas observações",
  "Ruim - Justificar o porquê e exemplificar nas observações",
];

const DEFAULT_EXPERIENCE_30_QUESTIONS: PerformanceQuestion[] = [
  {
    id: "normas_recebeu_informacoes",
    label:
      "Ao ingressar na empresa você recebeu informações com relação às normas internas e regras da empresa?",
    leaderLabel:
      "Ao ingressar na empresa o(a) colaborador(a) recebeu informações com relação às normas internas e regras da empresa?",
    type: "select",
    required: true,
    active: true,
    options: YES_NO_OPTIONS,
    helpText: "Normas e regras da empresa",
  },
  {
    id: "normas_informacoes_foram",
    label: "Essas informações foram:",
    type: "select",
    required: true,
    active: true,
    options: ["Suficientes", "Insuficientes"],
    helpText: "Normas e regras da empresa",
  },
  {
    id: "normas_faltaram_tipo",
    label: "Se insuficientes, faltaram informações:",
    type: "select",
    required: false,
    active: true,
    options: ["Administrativas", "Técnicas"],
    helpText: "Normas e regras da empresa",
  },
  {
    id: "normas_faltaram_descricao",
    label: "Quais informações faltaram? Descreva:",
    type: "textarea",
    required: false,
    active: true,
    helpText: "Normas e regras da empresa",
  },
  {
    id: "treinamento_recebeu",
    label: "Você recebeu ou recebe algum treinamento e/ou orientação para executar seu trabalho?",
    leaderLabel:
      "O(a) colaborador(a) recebeu ou recebe algum treinamento e/ou orientação para executar seu trabalho?",
    type: "select",
    required: true,
    active: true,
    options: YES_NO_OPTIONS,
    helpText: "Treinamentos, orientações, adaptação e aprendizado",
  },
  {
    id: "treinamento_quais",
    label: "Quais? Descreva:",
    type: "textarea",
    required: false,
    active: true,
    helpText: "Treinamentos, orientações, adaptação e aprendizado",
  },
  {
    id: "adaptacao_dificuldades",
    label: "Você apresentou dificuldades para adaptar-se ao ambiente de trabalho?",
    leaderLabel:
      "O(a) colaborador(a) apresentou dificuldades para adaptar-se ao ambiente de trabalho?",
    type: "select",
    required: true,
    active: true,
    options: YES_NO_OPTIONS,
    helpText: "Treinamentos, orientações, adaptação e aprendizado",
  },
  {
    id: "adaptacao_dificuldades_descricao",
    label: "Se apresentou dificuldades, quais foram? Descreva:",
    type: "textarea",
    required: false,
    active: true,
    helpText: "Treinamentos, orientações, adaptação e aprendizado",
  },
  {
    id: "adaptacao_como",
    label: "Como está sua adaptação?",
    type: "select",
    required: true,
    active: true,
    options: ["Lenta", "Normal", "Rápida"],
    helpText: "Treinamentos, orientações, adaptação e aprendizado",
  },
  {
    id: "adaptacao_mais",
    label: "Em que você mais se adaptou? Descreva:",
    leaderLabel: "Em que o(a) colaborador(a) mais se adaptou? Descreva:",
    type: "textarea",
    required: false,
    active: true,
    helpText: "Treinamentos, orientações, adaptação e aprendizado",
  },
  {
    id: "aprendizado_atividades",
    label: "Você está aprendendo o que é ensinado das suas atividades?",
    leaderLabel: "O(a) colaborador(a) está aprendendo o que é ensinado das suas atividades?",
    type: "select",
    required: true,
    active: true,
    options: YES_NO_OPTIONS,
    helpText: "Treinamentos, orientações, adaptação e aprendizado",
  },
  {
    id: "aprendizado_comente",
    label: "Comente:",
    type: "textarea",
    required: false,
    active: true,
    helpText: "Treinamentos, orientações, adaptação e aprendizado",
  },
  {
    id: "relacionamento_colegas",
    label: "Como é o seu relacionamento com os colegas?",
    leaderLabel: "Como é o relacionamento do(a) colaborador(a) com os colegas?",
    type: "select",
    required: true,
    active: true,
    options: RATING_OPTIONS,
    helpText: "Relacionamento",
  },
  {
    id: "relacionamento_colegas_comente",
    label: "Comente:",
    type: "textarea",
    required: false,
    active: true,
    helpText: "Relacionamento",
  },
  {
    id: "relacionamento_superior",
    label: "Como é o seu relacionamento com seu superior imediato?",
    leaderLabel: "Como é o relacionamento do(a) colaborador(a) com você?",
    type: "select",
    required: true,
    active: true,
    options: RATING_OPTIONS,
    helpText: "Relacionamento",
  },
  {
    id: "relacionamento_superior_comente",
    label: "Comente:",
    type: "textarea",
    required: false,
    active: true,
    helpText: "Relacionamento",
  },
  {
    id: "dialogo_trabalho",
    label:
      "Seu superior imediato mantém diálogo a respeito de seu trabalho, permitindo-lhe expor suas ideias, dificuldades, etc.?",
    leaderLabel:
      "Você mantém diálogo a respeito do trabalho do(a) colaborador(a), permitindo que exponha suas ideias, dificuldades, etc.?",
    type: "select",
    required: true,
    active: true,
    options: YES_NO_OPTIONS,
    helpText: "Relacionamento",
  },
  {
    id: "dialogo_trabalho_comente",
    label: "Comente:",
    type: "textarea",
    required: false,
    active: true,
    helpText: "Relacionamento",
  },
  {
    id: "satisfacao_trabalho",
    label: "Você está satisfeito com o trabalho que executa?",
    leaderLabel: "Você está satisfeito com o trabalho que o(a) colaborador(a) executa?",
    type: "select",
    required: true,
    active: true,
    options: YES_NO_OPTIONS,
    helpText: "Satisfação",
  },
  {
    id: "satisfacao_comente",
    label: "Comente:",
    type: "textarea",
    required: false,
    active: true,
    helpText: "Satisfação",
  },
  {
    id: "observacoes_adicionais",
    label: "Observações e comentários adicionais:",
    type: "textarea",
    required: false,
    active: true,
  },
];

const DEFAULT_EXPERIENCE_90_QUESTIONS: PerformanceQuestion[] = [
  {
    id: "treinamento_recebendo",
    label: "Você está recebendo algum treinamento e/ou orientação para executar seu trabalho?",
    leaderLabel:
      "O(a) colaborador(a) está recebendo algum treinamento e/ou orientação para executar seu trabalho?",
    type: "select",
    required: true,
    active: true,
    options: YES_NO_OPTIONS,
    helpText: "Treinamentos, orientações e aprendizado",
  },
  {
    id: "treinamento_quais",
    label: "Quais? Descreva:",
    type: "textarea",
    required: false,
    active: true,
    helpText: "Treinamentos, orientações e aprendizado",
  },
  {
    id: "aprendizado_atividades",
    label: "Você está aprendendo o que é ensinado das suas atividades?",
    leaderLabel: "O(a) colaborador(a) está aprendendo o que é ensinado das suas atividades?",
    type: "select",
    required: true,
    active: true,
    options: YES_NO_OPTIONS,
    helpText: "Treinamentos, orientações e aprendizado",
  },
  {
    id: "aprendizado_comente",
    label: "Comente:",
    type: "textarea",
    required: false,
    active: true,
    helpText: "Treinamentos, orientações e aprendizado",
  },
  {
    id: "relacionamento_colegas",
    label: "Como é o seu relacionamento com os colegas?",
    leaderLabel: "Como é o relacionamento do(a) colaborador(a) com os colegas?",
    type: "select",
    required: true,
    active: true,
    options: RATING_OPTIONS,
    helpText: "Relacionamento",
  },
  {
    id: "relacionamento_colegas_comente",
    label: "Comente:",
    type: "textarea",
    required: false,
    active: true,
    helpText: "Relacionamento",
  },
  {
    id: "relacionamento_superior",
    label: "Como é o seu relacionamento com seu superior imediato?",
    leaderLabel: "Como é o relacionamento do(a) colaborador(a) com você?",
    type: "select",
    required: true,
    active: true,
    options: RATING_OPTIONS,
    helpText: "Relacionamento",
  },
  {
    id: "relacionamento_superior_comente",
    label: "Comente:",
    type: "textarea",
    required: false,
    active: true,
    helpText: "Relacionamento",
  },
  {
    id: "dialogo_trabalho",
    label:
      "Seu superior imediato mantém diálogo a respeito de seu trabalho, permitindo-lhe expor suas ideias, dificuldades, etc.?",
    leaderLabel:
      "Você mantém diálogo a respeito do trabalho do(a) colaborador(a), permitindo que exponha suas ideias, dificuldades, etc.?",
    type: "select",
    required: true,
    active: true,
    options: YES_NO_OPTIONS,
    helpText: "Relacionamento",
  },
  {
    id: "dialogo_trabalho_comente",
    label: "Comente:",
    type: "textarea",
    required: false,
    active: true,
    helpText: "Relacionamento",
  },
  {
    id: "desempenho_atividades",
    label: "Como você avalia o seu desempenho nas atividades?",
    leaderLabel: "Como você avalia o desempenho do(a) colaborador(a) nas atividades?",
    type: "select",
    required: true,
    active: true,
    options: RATING_OPTIONS,
    helpText: "Autoavaliação do dia a dia de trabalho",
  },
  {
    id: "desempenho_atividades_comente",
    label: "Comente:",
    type: "textarea",
    required: false,
    active: true,
    helpText: "Autoavaliação do dia a dia de trabalho",
  },
  {
    id: "duvidas_dificuldades_atitude",
    label: "Quando você tem alguma dúvida ou dificuldades no trabalho, qual é sua atitude?",
    leaderLabel:
      "Quando o(a) colaborador(a) tem alguma dúvida ou dificuldades no trabalho, qual é a atitude?",
    type: "select",
    required: true,
    active: true,
    options: [
      "Resolvo sozinho",
      "Solicito ajuda ao colega",
      "Dirijo-me ao meu supervisor",
      "Nunca peço ajuda",
    ],
    leaderOptions: [
      "Resolve sozinho(a)",
      "Solicita ajuda ao colega",
      "Dirige-se a mim, supervisor",
      "Nunca pede ajuda",
    ],
    helpText: "Autoavaliação do dia a dia de trabalho",
  },
  {
    id: "duvidas_dificuldades_comente",
    label: "Comente:",
    type: "textarea",
    required: false,
    active: true,
    helpText: "Autoavaliação do dia a dia de trabalho",
  },
  {
    id: "metodo_empresa",
    label:
      "Você está desempenhando seu trabalho conforme o método utilizado pela empresa ou alterou algo?",
    leaderLabel:
      "O(a) colaborador(a) está desempenhando o trabalho conforme o método utilizado pela empresa ou alterou algo?",
    type: "select",
    required: true,
    active: true,
    options: [
      "Sigo os padrões da empresa",
      "Sigo os padrões, mas alterei algumas coisas",
      "Trabalho no meu método",
    ],
    leaderOptions: [
      "Segue os padrões da empresa",
      "Segue os padrões, mas alterou algumas coisas",
      "Trabalha no seu método",
    ],
    helpText: "Autoavaliação do dia a dia de trabalho",
  },
  {
    id: "metodo_empresa_comente",
    label: "Comente:",
    type: "textarea",
    required: false,
    active: true,
    helpText: "Autoavaliação do dia a dia de trabalho",
  },
  {
    id: "metodo_rendimento",
    label: "No caso de utilizar em parte, ou completamente seu método, houve maior rendimento?",
    type: "select",
    required: false,
    active: true,
    options: YES_NO_OPTIONS,
    helpText: "Autoavaliação do dia a dia de trabalho",
  },
  {
    id: "metodo_rendimento_comente",
    label: "Comente:",
    type: "textarea",
    required: false,
    active: true,
    helpText: "Autoavaliação do dia a dia de trabalho",
  },
  {
    id: "satisfacao_trabalho",
    label: "Você está satisfeito com o trabalho que executa?",
    leaderLabel: "Você está satisfeito com o trabalho que o(a) colaborador(a) executa?",
    type: "select",
    required: true,
    active: true,
    options: YES_NO_OPTIONS,
    helpText: "Satisfação",
  },
  {
    id: "satisfacao_comente",
    label: "Comente:",
    type: "textarea",
    required: false,
    active: true,
    helpText: "Satisfação",
  },
  {
    id: "observacoes_adicionais",
    label: "Observações e comentários adicionais:",
    type: "textarea",
    required: false,
    active: true,
  },
];

const STATUS_LABEL: Record<ParticipantStatus, string> = {
  not_sent: "Não enviado",
  sent: "Enviado",
  accessed: "Acessado",
  in_progress: "Em preenchimento",
  answered: "Respondido",
};
const REVIEW_STATUS_LABEL: Record<ReviewStatus, string> = {
  draft: "Rascunho",
  waiting_responses: "Aguardando respostas",
  ready_for_comparison: "Pronta para comparação",
  finalized: "Finalizada",
};
const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
const inputClass =
  "w-full rounded-lg border border-[#042558]/20 bg-white/70 px-3 py-2 text-sm text-[#042558] outline-none focus:border-[#042558] focus:ring-2 focus:ring-[#042558]/20";
const EXPERIENCE_REVIEW_PERIOD_OPTIONS = [
  { days: 30, label: "30 dias" },
  { days: 45, label: "45 dias" },
  { days: 90, label: "90 dias" },
];
const PERFORMANCE_REVIEW_PERIOD_OPTIONS = [
  { days: 90, label: "3 meses" },
  { days: 180, label: "6 meses" },
  { days: 365, label: "1 ano" },
];

function reviewPeriodOptionsForType(type: ReviewType) {
  return type === "experience"
    ? EXPERIENCE_REVIEW_PERIOD_OPTIONS
    : PERFORMANCE_REVIEW_PERIOD_OPTIONS;
}

function defaultQuestionsForConfig(reviewType: ReviewType) {
  const source =
    reviewType === "experience"
      ? DEFAULT_EXPERIENCE_30_QUESTIONS
      : DEFAULT_AVDP_QUESTIONS.length
        ? DEFAULT_AVDP_QUESTIONS
        : DEFAULT_PERFORMANCE_QUESTIONS;
  return source.map((question) => ({ ...question, id: `${question.id}_${uid()}` }));
}

function displayQuestionLabel(question: PerformanceQuestion, participantType?: ParticipantType) {
  return participantType === "leader" && question.leaderLabel?.trim()
    ? question.leaderLabel
    : question.label;
}

function questionOptions(question: PerformanceQuestion, participantType?: ParticipantType) {
  return participantType === "leader" && question.leaderOptions?.length
    ? question.leaderOptions
    : (question.options ?? []);
}

function normalizeLookup(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function stringFromUnknown(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
}

function pickItemValue(item: Record<string, unknown>, preferredKeys: string[]) {
  const entries = Object.entries(item);
  for (const key of preferredKeys) {
    const normalizedKey = normalizeLookup(key);
    const match = entries.find(([entryKey]) => normalizeLookup(entryKey).includes(normalizedKey));
    const value = match ? stringFromUnknown(match[1]) : "";
    if (value && !isInternalOptionValue(value)) return value;
  }
  const values = entries
    .filter(([key]) => !["id", "created_at", "updated_at"].includes(normalizeLookup(key)))
    .map(([, value]) => stringFromUnknown(value))
    .filter(
      (value) =>
        value &&
        !["sim", "nao", "não"].includes(normalizeLookup(value)) &&
        !isInternalOptionValue(value),
    );
  return values.sort((a, b) => b.length - a.length)[0] ?? "";
}

function isInternalOptionValue(value: string) {
  const normalized = normalizeLookup(value);
  return (
    /^(sim|nao|não)_\d+$/.test(normalized) ||
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(normalized)
  );
}

function isNonTitleValue(value: string) {
  const normalized = normalizeLookup(value);
  return (
    !normalized ||
    /^atividade\s+\d+$/.test(normalized) ||
    /^item\s+\d+$/.test(normalized) ||
    ["sim", "nao", "não"].includes(normalized) ||
    [
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
    ].includes(normalized) ||
    isInternalOptionValue(value)
  );
}

function fieldsForDynamicSource(
  fields: BaseFieldRow[],
  source: PerformanceQuestion["dynamicSource"],
) {
  const sectionNames: Record<NonNullable<PerformanceQuestion["dynamicSource"]>, string[]> = {
    activities: ["atividades"],
    indicators: ["indicadores"],
    culture_skills: ["habilidades culturais"],
    role_skills: ["habilidades do cargo"],
    behavior: ["postura", "comportamento"],
  };
  const expected = source ? sectionNames[source] : [];
  return fields.filter((field) => {
    const section = normalizeLookup(field.section);
    return expected.some((name) => section.includes(name));
  });
}

function optionLabelForValue(field: BaseFieldRow, value: string) {
  return (
    field.base_options?.find((option) => option.value === value && option.is_active !== false)
      ?.label ?? value
  );
}

function pickItemValueFromFields(
  item: Record<string, unknown>,
  fields: BaseFieldRow[],
  includes: string[],
  excludes: string[] = [],
) {
  const includeTerms = includes.map(normalizeLookup);
  const excludeTerms = excludes.map(normalizeLookup);
  const field = fields.find((candidate) => {
    const label = normalizeLookup(candidate.label);
    const key = normalizeLookup(candidate.field_key);
    const searchable = `${label} ${key}`;
    return (
      includeTerms.some((term) => searchable.includes(term)) &&
      !excludeTerms.some((term) => searchable.includes(term))
    );
  });
  if (!field) return "";
  const value = stringFromUnknown(item[field.field_key]);
  if (!value || isInternalOptionValue(value)) return "";
  return optionLabelForValue(field, value);
}

function pickItemValueFromExactLabel(
  item: Record<string, unknown>,
  fields: BaseFieldRow[],
  labels: string[],
) {
  const expected = labels.map(normalizeLookup);
  const field = fields.find((candidate) => expected.includes(normalizeLookup(candidate.label)));
  if (!field) return "";
  const value = stringFromUnknown(item[field.field_key]);
  if (!value || isNonTitleValue(value)) return "";
  return optionLabelForValue(field, value);
}

function pickItemValueFromExactKey(item: Record<string, unknown>, names: string[]) {
  const expected = names.map(normalizeLookup);
  const entry = Object.entries(item).find(([key]) => expected.includes(normalizeLookup(key)));
  const value = entry ? stringFromUnknown(entry[1]) : "";
  return value && !isNonTitleValue(value) ? value : "";
}

function dynamicItemsForQuestion(dc: DcRow, question: PerformanceQuestion) {
  if (question.dynamicSource === "activities") return dc.atividades ?? [];
  if (question.dynamicSource === "indicators") return dc.indicadores ?? [];
  if (question.dynamicSource === "culture_skills") return dc.habilidades_culturais ?? [];
  if (question.dynamicSource === "role_skills") return dc.habilidades_cargo ?? [];
  if (question.dynamicSource === "behavior") return dc.postura ?? [];
  return [];
}

function dynamicItemTitle(
  question: PerformanceQuestion,
  item: Record<string, unknown>,
  fields: BaseFieldRow[] = [],
) {
  const sourceFields = fieldsForDynamicSource(fields, question.dynamicSource);
  if (question.dynamicSource === "activities") {
    return (
      pickItemValueFromExactLabel(item, fields, ["Atividade"]) ||
      pickItemValueFromExactKey(item, ["atividade"]) ||
      pickItemValueFromFields(item, sourceFields, ["atividade"], ["principal"]) ||
      pickItemValue(item, ["atividade", "descricao", "descrição", "texto", "nome"])
    );
  }
  if (question.dynamicSource === "indicators") {
    const indicator =
      pickItemValueFromExactLabel(item, sourceFields, [
        "Indicador",
        "Indicador relacionado",
        "Nomenclatura do indicador",
        "Nome do indicador",
      ]) ||
      pickItemValueFromExactKey(item, ["indicador", "indicador_relacionado", "nomenclatura"]) ||
      pickItemValueFromFields(item, sourceFields, ["indicador", "nomenclatura", "nome"]) ||
      pickItemValue(item, ["indicador", "nomenclatura", "nome"]);
    const goal =
      pickItemValueFromExactLabel(item, sourceFields, ["Meta", "Resultado esperado"]) ||
      pickItemValueFromExactKey(item, ["meta", "resultado_esperado"]) ||
      pickItemValueFromFields(item, sourceFields, ["meta", "resultado esperado"]) ||
      pickItemValue(item, ["meta", "resultado esperado"]);
    return [indicator, goal ? `Meta: ${goal}` : ""].filter(Boolean).join(" | ");
  }
  const titleLabels: Record<string, string[]> = {
    culture_skills: ["Habilidade cultural", "Habilidade", "Competência", "Competencia"],
    role_skills: [
      "Habilidade do cargo",
      "Habilidade específica do cargo",
      "Habilidade especifica do cargo",
      "Habilidade",
      "Competência",
      "Competencia",
    ],
    behavior: ["Postura e comportamento", "Postura", "Comportamento"],
  };
  const titleKeys: Record<string, string[]> = {
    culture_skills: ["habilidade_cultural", "habilidade", "competencia"],
    role_skills: ["habilidade_cargo", "habilidade_do_cargo", "habilidade", "competencia"],
    behavior: ["postura_comportamento", "postura", "comportamento"],
  };
  const titleFromFields = pickItemValueFromFields(item, sourceFields, [
    "habilidade",
    "postura",
    "comportamento",
    "competencia",
    "competência",
    "nome",
    "descricao",
    "descrição",
  ]);
  return (
    pickItemValueFromExactLabel(
      item,
      sourceFields,
      titleLabels[question.dynamicSource ?? ""] ?? [],
    ) ||
    pickItemValueFromExactKey(item, titleKeys[question.dynamicSource ?? ""] ?? []) ||
    titleFromFields ||
    pickItemValue(item, [
      "habilidade",
      "postura",
      "comportamento",
      "competencia",
      "competência",
      "nome",
      "descricao",
      "descrição",
    ])
  );
}

function buildReviewQuestions(
  configQuestions: PerformanceQuestion[],
  dc: DcRow,
  reviewType: ReviewType,
  fields: BaseFieldRow[] = [],
): PerformanceQuestion[] {
  const activeQuestions: PerformanceQuestion[] = (configQuestions ?? [])
    .filter((question) => question.active ?? true)
    .map((question) => ({ ...question, source: "config" as const }));
  if (reviewType !== "performance") return activeQuestions;

  return activeQuestions.flatMap((question) => {
    if (!question.dynamicSource) return [question];
    const items = dynamicItemsForQuestion(dc, question);
    return items.reduce<PerformanceQuestion[]>((questions, item, index) => {
      const title = dynamicItemTitle(question, item, fields);
      if (!title) return questions;
      questions.push({
        ...question,
        id: `${question.id}_${index + 1}`,
        source: "job_description" as const,
        groupId: `${question.dynamicSource}_${index + 1}`,
        groupTitle: title,
        helpText: question.helpText,
      });
      return questions;
    }, []);
  });
}

function displayQuestionGroupTitle(question: PerformanceQuestion) {
  if (question.groupTitle && !isInternalOptionValue(question.groupTitle))
    return question.groupTitle;
  const sourceLabel: Record<string, string> = {
    activities: "Atividade",
    indicators: "Indicador",
    culture_skills: "Habilidade",
    role_skills: "Habilidade",
    behavior: "Postura e comportamento",
  };
  const suffix = question.groupId?.match(/_(\d+)$/)?.[1];
  return `${sourceLabel[question.dynamicSource ?? ""] ?? "Item"}${suffix ? ` ${suffix}` : ""}`;
}

export function PerformanceReviewManager({ projectId }: { projectId: string }) {
  const { user, isAdmin } = useCurrentUser();
  const [tab, setTab] = useState<"reviews" | "schedule">("reviews");
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
    supabase
      .from("project_members")
      .select("role")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setCanManage(data?.role === "gp" || data?.role === "admin");
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin, projectId, user]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#042558]/5 via-white to-[#042558]/5 px-6 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 rounded-2xl border border-[#042558]/10 bg-white/80 p-6 shadow-sm backdrop-blur-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#042558]/50">
            Avaliacoes
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#042558]">
            Experiencia e desempenho
          </h1>
          <p className="mt-1 text-sm text-[#042558]/60">
            Ate 90 dias de admissao, a avaliacao entra como experiencia; depois disso, entra como
            desempenho.
          </p>
        </div>

        <div className="mb-8 border-b border-[#042558]/10">
          <div className="flex gap-8">
            <TabButton active={tab === "reviews"} onClick={() => setTab("reviews")}>
              Avaliações
            </TabButton>
            {canManage && (
              <TabButton active={tab === "schedule"} onClick={() => setTab("schedule")}>
                Agenda
              </TabButton>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-[#042558]/10 bg-white/60 p-6 shadow-sm backdrop-blur-sm">
          {!canManage ? (
            <div className="rounded-xl border border-dashed border-[#042558]/20 p-8 text-center text-sm text-[#042558]/50">
              Apenas GP e administradores podem criar e comparar avaliacoes.
            </div>
          ) : tab === "schedule" ? (
            <PerformanceAgendaPanel projectId={projectId} />
          ) : (
            <PerformanceReviewsPanel projectId={projectId} />
          )}
        </div>
      </div>
    </main>
  );
}

export function PerformanceComparisonPage({
  projectId,
  reviewId,
}: {
  projectId: string;
  reviewId: string;
}) {
  const { user, isAdmin } = useCurrentUser();
  const [review, setReview] = useState<ReviewRow | null>(null);
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [authors, setAuthors] = useState<Record<string, string>>({});
  const [canManage, setCanManage] = useState(false);
  const [mobileSide, setMobileSide] = useState<ParticipantType>("collaborator");

  const load = useCallback(async () => {
    const [{ data: rev }, { data: parts }, { data: comm }, { data: hist }] = await Promise.all([
      supabase
        .from("performance_reviews")
        .select("*")
        .eq("project_id", projectId)
        .eq("id", reviewId)
        .maybeSingle(),
      supabase.from("performance_review_participants").select("*").eq("review_id", reviewId),
      supabase
        .from("performance_review_comments")
        .select("*")
        .eq("review_id", reviewId)
        .order("created_at", { ascending: true }),
      supabase
        .from("performance_answer_history")
        .select("*")
        .eq("review_id", reviewId)
        .order("changed_at", { ascending: false }),
    ]);
    setReview((rev as ReviewRow | null) ?? null);
    setParticipants((parts ?? []) as ParticipantRow[]);
    setComments((comm ?? []) as CommentRow[]);
    setHistory((hist ?? []) as HistoryRow[]);
  }, [projectId, reviewId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (isAdmin) {
      setCanManage(true);
      return;
    }
    if (!user) return;
    void supabase
      .from("project_members")
      .select("role")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setCanManage(data?.role === "gp" || data?.role === "admin");
      });
  }, [isAdmin, projectId, user]);

  useEffect(() => {
    const ids = Array.from(
      new Set([
        ...comments.map((c) => c.author_id),
        ...(history.map((h) => h.changed_by).filter(Boolean) as string[]),
      ]),
    );
    if (!ids.length) return;
    void supabase
      .from("profiles")
      .select("id,nome")
      .in("id", ids)
      .then(({ data }) => {
        const next: Record<string, string> = {};
        (data ?? []).forEach((p) => {
          next[p.id] = p.nome;
        });
        setAuthors(next);
      });
  }, [comments, history]);

  if (!review) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Carregando avaliação...
      </div>
    );
  }

  const collaborator = participants.find((p) => p.participant_type === "collaborator") ?? null;
  const leader = participants.find((p) => p.participant_type === "leader") ?? null;
  const questions = allReviewQuestions(review);
  const locked = review.status === "finalized";

  const addComment = async (questionKey: string, content: string) => {
    if (!user || locked) return;
    const { error } = await supabase.from("performance_review_comments").insert({
      review_id: review.id,
      question_key: questionKey,
      author_id: user.id,
      content,
    });
    if (error) return toast.error(error.message);
    await load();
  };

  const updateAnswer = async (
    participant: ParticipantRow,
    questionKey: string,
    nextAnswer: string,
  ) => {
    if (!canManage || locked) return;
    const current = participant.response_answers?.[questionKey] ?? "";
    if (current === nextAnswer) return;
    if (!confirm("Alterar esta resposta? O valor anterior será mantido no histórico.")) return;
    const nextAnswers = { ...(participant.response_answers ?? {}), [questionKey]: nextAnswer };
    const { error } = await supabase
      .from("performance_review_participants")
      .update({ response_answers: nextAnswers })
      .eq("id", participant.id);
    if (error) return toast.error(error.message);
    await supabase.from("performance_answer_history").insert({
      participant_id: participant.id,
      review_id: review.id,
      question_key: questionKey,
      previous_answer: current,
      new_answer: nextAnswer,
      changed_by: user?.id ?? null,
    });
    toast.success("Resposta alterada");
    await load();
  };

  const finalize = async () => {
    if (
      !collaborator ||
      !leader ||
      collaborator.status !== "answered" ||
      leader.status !== "answered"
    ) {
      toast.error("A avaliação só pode ser finalizada depois das duas respostas.");
      return;
    }
    const { error } = await supabase
      .from("performance_reviews")
      .update({
        status: "finalized",
        finalized_by: user?.id ?? null,
        finalized_at: new Date().toISOString(),
      })
      .eq("id", review.id);
    if (error) return toast.error(error.message);
    if (review.employee_id) {
      await supabase
        .from("project_employees")
        .update({
          last_performance_review_date: review.due_date ?? new Date().toISOString().slice(0, 10),
        })
        .eq("id", review.employee_id)
        .eq("project_id", projectId);
    }
    toast.success("Avaliação finalizada");
    await load();
  };

  const reopen = async () => {
    if (!canManage || !confirm("Reabrir esta avaliação para alterações?")) return;
    const { error } = await supabase
      .from("performance_reviews")
      .update({
        status: "ready_for_comparison",
        reopened_by: user?.id ?? null,
        reopened_at: new Date().toISOString(),
        finalized_by: null,
        finalized_at: null,
      })
      .eq("id", review.id);
    if (error) return toast.error(error.message);
    toast.success("Avaliação reaberta");
    await load();
  };

  return (
    <main className="min-h-screen bg-white text-[#042558]">
      <div className="sticky top-0 z-20 border-b border-[#042558]/10 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#042558]/50">
              Comparação de avaliação
            </p>
            <h1 className="text-xl font-bold">{review.name}</h1>
            <p className="text-sm text-[#042558]/60">
              {review.employee_name} · {review.job_title} · Líder: {review.leader_name}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {review.status === "finalized" ? (
              <button
                onClick={reopen}
                className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800"
              >
                <RotateCcw className="h-4 w-4" /> Reabrir
              </button>
            ) : (
              <button
                onClick={finalize}
                className="inline-flex items-center gap-2 rounded-lg bg-[#042558] px-3 py-2 text-sm font-medium text-white"
              >
                <CheckCircle2 className="h-4 w-4" /> Finalizar avaliação
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-4">
        <div className="mb-4 flex rounded-lg border border-[#042558]/15 p-1 md:hidden">
          <button
            onClick={() => setMobileSide("collaborator")}
            className={`flex-1 rounded-md px-3 py-2 text-sm ${mobileSide === "collaborator" ? "bg-[#042558] text-white" : "text-[#042558]/60"}`}
          >
            Colaborador
          </button>
          <button
            onClick={() => setMobileSide("leader")}
            className={`flex-1 rounded-md px-3 py-2 text-sm ${mobileSide === "leader" ? "bg-[#042558] text-white" : "text-[#042558]/60"}`}
          >
            Líder
          </button>
        </div>

        <div className="mb-4 rounded-xl border border-[#042558]/10 bg-[#042558]/5 p-4 text-sm">
          <span className="font-semibold">Modo de apresentação:</span> respostas alinhadas lado a
          lado, comentários por pergunta e histórico disponível quando houver alteração.
        </div>

        <div className="space-y-4">
          {questions.map((question) => {
            const leftAnswer = collaborator?.response_answers?.[question.id] ?? "";
            const rightAnswer = leader?.response_answers?.[question.id] ?? "";
            const different =
              question.type === "select" && leftAnswer && rightAnswer && leftAnswer !== rightAnswer;
            return (
              <section
                key={question.id}
                className={`rounded-xl border p-4 ${different ? "border-red-300 bg-red-50/80" : "border-[#042558]/10 bg-white"}`}
              >
                <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#042558]/50">
                      {question.sectionTitle ?? "Pergunta"}
                    </p>
                    {question.groupId && (
                      <p className="mt-1 whitespace-pre-wrap text-sm font-medium text-[#042558]/75">
                        {displayQuestionGroupTitle(question)}
                      </p>
                    )}
                    <h2 className="text-base font-semibold">{question.label}</h2>
                    {question.leaderLabel?.trim() && question.leaderLabel !== question.label && (
                      <p className="mt-1 text-sm text-[#042558]/55">
                        Líder: {question.leaderLabel}
                      </p>
                    )}
                  </div>
                  <CommentBox
                    questionKey={question.id}
                    comments={comments.filter((c) => c.question_key === question.id)}
                    authors={authors}
                    disabled={locked}
                    onAdd={addComment}
                  />
                </div>
                <div className="hidden grid-cols-[1fr_1px_1fr] gap-4 md:grid">
                  <AnswerCell
                    title="Colaborador"
                    participant={collaborator}
                    question={question}
                    canEdit={canManage && !locked}
                    onChange={updateAnswer}
                  />
                  <div className="bg-[#042558]/15" />
                  <AnswerCell
                    title="Líder"
                    participant={leader}
                    question={question}
                    canEdit={canManage && !locked}
                    onChange={updateAnswer}
                  />
                </div>
                <div className="md:hidden">
                  <AnswerCell
                    title={mobileSide === "collaborator" ? "Colaborador" : "Líder"}
                    participant={mobileSide === "collaborator" ? collaborator : leader}
                    question={question}
                    canEdit={canManage && !locked}
                    onChange={updateAnswer}
                  />
                </div>
                <HistoryList
                  history={history.filter((h) => h.question_key === question.id)}
                  authors={authors}
                />
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}

function PerformanceConfigPanel({ projectId }: { projectId: string }) {
  const [configId, setConfigId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<PerformanceQuestion[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [newLabel, setNewLabel] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("performance_review_configs")
      .select("*")
      .eq("project_id", projectId)
      .maybeSingle();
    if (data) {
      const cfg = toConfigRow(data);
      setConfigId(cfg.id);
      setQuestions((cfg.questions_schema ?? []).map((q) => ({ ...q, active: q.active ?? true })));
      setIsActive(cfg.is_active);
    } else {
      setConfigId(null);
      setQuestions(defaultQuestionsForConfig("experience"));
      setIsActive(true);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const payload = {
      project_id: projectId,
      questions_schema: questions,
      is_active: isActive,
      created_by: userData.user?.id ?? null,
    };
    const { error } = configId
      ? await supabase.from("performance_review_configs").update(payload).eq("id", configId)
      : await supabase.from("performance_review_configs").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Configuração salva");
    await load();
  };

  const addQuestion = () => {
    const label = newLabel.trim();
    if (!label) return;
    setQuestions((current) => [
      ...current,
      { id: uid(), label, type: "text", required: false, active: true, source: "config" },
    ]);
    setNewLabel("");
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#042558]">Perguntas da avaliação</h2>
          <p className="text-sm text-[#042558]/60">
            Somente as perguntas configuradas no modelo entram na avaliação.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="flex items-center gap-2 rounded-lg border border-[#042558]/20 px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />{" "}
            Ativo
          </label>
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-[#042558] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            <Save className="h-4 w-4" /> {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addQuestion())}
          placeholder="Nova pergunta"
          className={inputClass}
        />
        <button
          onClick={addQuestion}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[#042558] px-4 py-2 text-sm font-medium text-white"
        >
          <Plus className="h-4 w-4" /> Criar
        </button>
      </div>

      <div className="space-y-3">
        {questions.map((question) => (
          <div key={question.id} className="rounded-xl border border-[#042558]/10 bg-white/70 p-4">
            <div className="grid gap-3 md:grid-cols-[1fr_150px_auto]">
              <div className="grid gap-2">
                <input
                  value={question.label}
                  onChange={(e) =>
                    setQuestions((current) =>
                      current.map((q) =>
                        q.id === question.id ? { ...q, label: e.target.value } : q,
                      ),
                    )
                  }
                  placeholder="Texto para colaborador"
                  className={inputClass}
                />
                <input
                  value={question.leaderLabel ?? ""}
                  onChange={(e) =>
                    setQuestions((current) =>
                      current.map((q) =>
                        q.id === question.id
                          ? { ...q, leaderLabel: e.target.value || undefined }
                          : q,
                      ),
                    )
                  }
                  placeholder="Texto para líder (opcional)"
                  className={inputClass}
                />
              </div>
              <select
                value={question.type}
                onChange={(e) =>
                  setQuestions((current) =>
                    current.map((q) =>
                      q.id === question.id ? { ...q, type: e.target.value as FieldType } : q,
                    ),
                  )
                }
                className={inputClass}
              >
                <option value="text">Texto</option>
                <option value="textarea">Texto longo</option>
                <option value="select">Seleção única</option>
              </select>
              <button
                onClick={() =>
                  setQuestions((current) => current.filter((q) => q.id !== question.id))
                }
                className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50"
              >
                Remover
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-sm text-[#042558]/60">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={question.required}
                  onChange={(e) =>
                    setQuestions((current) =>
                      current.map((q) =>
                        q.id === question.id ? { ...q, required: e.target.checked } : q,
                      ),
                    )
                  }
                />{" "}
                Obrigatório
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={question.active ?? true}
                  onChange={(e) =>
                    setQuestions((current) =>
                      current.map((q) =>
                        q.id === question.id ? { ...q, active: e.target.checked } : q,
                      ),
                    )
                  }
                />{" "}
                Ativo
              </label>
            </div>
            {question.type === "select" && (
              <div className="grid gap-3 md:grid-cols-2">
                <SelectOptionsEditor
                  title="Opções do colaborador"
                  options={question.options ?? []}
                  onChange={(options) =>
                    setQuestions((current) =>
                      current.map((q) => (q.id === question.id ? { ...q, options } : q)),
                    )
                  }
                />
                <SelectOptionsEditor
                  title="Opções do líder"
                  options={question.leaderOptions ?? []}
                  onChange={(leaderOptions) =>
                    setQuestions((current) =>
                      current.map((q) => (q.id === question.id ? { ...q, leaderOptions } : q)),
                    )
                  }
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function PerformancePeriodConfigPanel({
  projectId,
  initialReviewType = "experience",
  hideReviewTypeTabs = false,
}: {
  projectId: string | null;
  initialReviewType?: ReviewType | null;
  hideReviewTypeTabs?: boolean;
}) {
  const { user } = useCurrentUser();
  const [configs, setConfigs] = useState<ConfigRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<PerformanceQuestion[]>([]);
  const [modelName, setModelName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [newLabel, setNewLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [configTypeTab, setConfigTypeTab] = useState<ReviewType>(initialReviewType ?? "experience");

  const hydrate = (config: ConfigRow) => {
    const normalized = normalizeConfigRow(config);
    setModelName(normalized.name ?? periodLabel(normalized));
    setQuestions(
      (normalized.questions_schema ?? []).map((question) => ({
        ...question,
        active: question.active ?? true,
      })),
    );
    setIsActive(normalized.is_active);
  };

  const load = useCallback(async () => {
    let query = supabase
      .from("performance_review_configs")
      .select("*")
      .order("period_days", { ascending: true });
    query = projectId ? query.eq("project_id", projectId) : query.is("project_id", null);
    const { data, error } = await query;
    if (error) {
      toast.error(error.message);
      return;
    }

    let rows = toConfigRows(data);
    const missingTypes = (["experience", "performance"] as ReviewType[]).filter(
      (type) => !rows.some((config) => (config.review_type ?? "experience") === type),
    );
    if (missingTypes.length > 0) {
      const { error: insertError } = await supabase.from("performance_review_configs").insert(
        missingTypes.map((type) => ({
          project_id: projectId,
          name: type === "experience" ? "Avaliacao de experiencia" : "Avaliacao de desempenho",
          period_days: EXPERIENCE_LIMIT_DAYS,
          review_type: type,
          questions_schema: defaultQuestionsForConfig(type),
          is_active: true,
          created_by: user?.id ?? null,
        })) as never,
      );
      if (insertError) {
        toast.error(insertError.message);
      } else {
        let refreshedQuery = supabase
          .from("performance_review_configs")
          .select("*")
          .order("period_days", { ascending: true });
        refreshedQuery = projectId
          ? refreshedQuery.eq("project_id", projectId)
          : refreshedQuery.is("project_id", null);
        const { data: refreshed } = await refreshedQuery;
        rows = toConfigRows(refreshed);
      }
    }

    setConfigs(rows);
    const selected = rows.find((config) => config.id === selectedId) ?? null;
    const initialSelected =
      selected && (selected.review_type ?? "experience") === configTypeTab
        ? selected
        : (rows.find(
            (config) => (config.review_type ?? "experience") === configTypeTab && config.is_active,
          ) ??
          rows.find((config) => (config.review_type ?? "experience") === configTypeTab) ??
          null);
    if (initialSelected) {
      setSelectedId(initialSelected.id);
      hydrate(initialSelected);
    } else setSelectedId(null);
  }, [configTypeTab, projectId, selectedId, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedConfig = configs.find((config) => config.id === selectedId) ?? null;
  const configCounts = configs.reduce(
    (acc, config) => {
      if (config.is_active) acc[config.review_type ?? "experience"] += 1;
      return acc;
    },
    { experience: 0, performance: 0 } as Record<ReviewType, number>,
  );

  const save = async () => {
    if (!selectedConfig) return toast.error("Selecione um modelo.");
    if (!modelName.trim()) return toast.error("Informe o nome do modelo.");

    setSaving(true);
    const { error } = await supabase
      .from("performance_review_configs")
      .update({
        name: modelName.trim(),
        period_days: selectedConfig.period_days ?? EXPERIENCE_LIMIT_DAYS,
        review_type: selectedConfig.review_type ?? "experience",
        questions_schema: toJson(questions),
        is_active: isActive,
      })
      .eq("id", selectedConfig.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Modelo salvo");
    await load();
  };

  const addQuestion = () => {
    const label = newLabel.trim();
    if (!label) return;
    setQuestions((current) => [
      ...current,
      { id: uid(), label, type: "text", required: false, active: true, source: "config" },
    ]);
    setNewLabel("");
  };

  return (
    <div className="space-y-5">
      {!hideReviewTypeTabs && (
        <section className="border-b border-[#042558]/10 pb-1">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-[#042558]">
                Tipo de modelo
              </h2>
              <p className="mt-1 text-xs text-[#042558]/50">
                Configure um modelo de perguntas para experiencia e outro para desempenho.
              </p>
            </div>
            <div className="flex min-w-fit gap-6">
              {(["experience", "performance"] as ReviewType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    setConfigTypeTab(type);
                    setSelectedId(null);
                  }}
                  className={`relative pb-3 text-sm font-semibold transition ${
                    configTypeTab === type
                      ? "text-[#042558]"
                      : "text-[#042558]/40 hover:text-[#042558]/70"
                  }`}
                >
                  {type === "experience" ? "Modelo de experiencia" : "Modelo de desempenho"}
                  <span
                    className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${
                      configTypeTab === type
                        ? "bg-[#042558]/10 text-[#042558]"
                        : "bg-[#042558]/5 text-[#042558]/45"
                    }`}
                  >
                    {configCounts[type]}
                  </span>
                  {configTypeTab === type && (
                    <span className="absolute bottom-0 left-0 h-0.5 w-full rounded-full bg-[#042558]" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {selectedConfig ? (
        <section className="rounded-2xl border border-[#042558]/10 bg-white/70 p-5">
          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#042558]/45">
                Configuracao do modelo
              </p>
              <h2 className="mt-1 text-xl font-bold text-[#042558]">
                {periodLabel(selectedConfig)}
              </h2>
              <p className="text-sm text-[#042558]/60">
                As perguntas deste modelo serao usadas em qualquer dia escolhido na criacao da
                avaliacao.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="flex items-center gap-2 rounded-lg border border-[#042558]/20 px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(event) => setIsActive(event.target.checked)}
                />
                Ativo
              </label>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-[#042558] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                <Save className="h-4 w-4" /> {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>

          <div className="mb-5 grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[#042558]/70">
                Nome do modelo
              </span>
              <input
                value={modelName}
                onChange={(event) => setModelName(event.target.value)}
                className={inputClass}
                placeholder="Ex: Avaliacao de experiencia"
              />
            </label>
            <div className="rounded-lg border border-[#042558]/10 bg-[#042558]/5 px-3 py-2 text-sm text-[#042558]/65">
              O ciclo da avaliacao sera escolhido ao criar/enviar o formulario.
            </div>
          </div>

          <div className="mb-5 flex gap-2">
            <input
              value={newLabel}
              onChange={(event) => setNewLabel(event.target.value)}
              onKeyDown={(event) =>
                event.key === "Enter" && (event.preventDefault(), addQuestion())
              }
              placeholder="Nova pergunta"
              className={inputClass}
            />
            <button
              type="button"
              onClick={addQuestion}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[#042558] px-4 py-2 text-sm font-medium text-white"
            >
              <Plus className="h-4 w-4" /> Criar
            </button>
          </div>

          <div className="space-y-3">
            {questions.map((question) => (
              <div
                key={question.id}
                className="rounded-xl border border-[#042558]/10 bg-white/70 p-4"
              >
                <div className="grid gap-3 md:grid-cols-[1fr_150px_auto]">
                  <div className="grid gap-2">
                    <input
                      value={question.label}
                      onChange={(event) =>
                        setQuestions((current) =>
                          current.map((q) =>
                            q.id === question.id ? { ...q, label: event.target.value } : q,
                          ),
                        )
                      }
                      placeholder="Texto para colaborador"
                      className={inputClass}
                    />
                    <input
                      value={question.leaderLabel ?? ""}
                      onChange={(event) =>
                        setQuestions((current) =>
                          current.map((q) =>
                            q.id === question.id
                              ? { ...q, leaderLabel: event.target.value || undefined }
                              : q,
                          ),
                        )
                      }
                      placeholder="Texto para líder (opcional)"
                      className={inputClass}
                    />
                  </div>
                  <select
                    value={question.type}
                    onChange={(event) =>
                      setQuestions((current) =>
                        current.map((q) =>
                          q.id === question.id
                            ? { ...q, type: event.target.value as FieldType }
                            : q,
                        ),
                      )
                    }
                    className={inputClass}
                  >
                    <option value="text">Texto</option>
                    <option value="textarea">Texto longo</option>
                    <option value="select">Selecao unica</option>
                  </select>
                  <button
                    type="button"
                    onClick={() =>
                      setQuestions((current) => current.filter((q) => q.id !== question.id))
                    }
                    className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50"
                  >
                    Remover
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-4 text-sm text-[#042558]/60">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={question.required}
                      onChange={(event) =>
                        setQuestions((current) =>
                          current.map((q) =>
                            q.id === question.id ? { ...q, required: event.target.checked } : q,
                          ),
                        )
                      }
                    />
                    Obrigatorio
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={question.active ?? true}
                      onChange={(event) =>
                        setQuestions((current) =>
                          current.map((q) =>
                            q.id === question.id ? { ...q, active: event.target.checked } : q,
                          ),
                        )
                      }
                    />
                    Ativo
                  </label>
                </div>
                {question.type === "select" && (
                  <div className="grid gap-3 md:grid-cols-2">
                    <SelectOptionsEditor
                      title="Opções do colaborador"
                      options={question.options ?? []}
                      onChange={(options) =>
                        setQuestions((current) =>
                          current.map((q) => (q.id === question.id ? { ...q, options } : q)),
                        )
                      }
                    />
                    <SelectOptionsEditor
                      title="Opções do líder"
                      options={question.leaderOptions ?? []}
                      onChange={(leaderOptions) =>
                        setQuestions((current) =>
                          current.map((q) => (q.id === question.id ? { ...q, leaderOptions } : q)),
                        )
                      }
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      ) : (
        <div className="rounded-xl border-2 border-dashed border-[#042558]/15 bg-white/60 p-8 text-center text-sm text-[#042558]/45">
          Carregando modelo...
        </div>
      )}
    </div>
  );
}

function normalizeConfigRow(config: ConfigRow): ConfigRow {
  return {
    ...config,
    name: config.name ?? "Padrao",
    period_days: config.period_days ?? 30,
    review_type: config.review_type ?? "experience",
    questions_schema: config.questions_schema ?? [],
    is_active: config.is_active ?? true,
  };
}

function toConfigRow(row: unknown): ConfigRow {
  return normalizeConfigRow(row as ConfigRow);
}

function toConfigRows(rows: unknown): ConfigRow[] {
  return ((rows ?? []) as ConfigRow[]).map(normalizeConfigRow);
}

function toReviewRows(rows: unknown): ReviewRow[] {
  return (rows ?? []) as ReviewRow[];
}

function toJson(value: unknown): Json {
  return value as Json;
}

function periodLabel(config: ConfigRow) {
  const normalized = normalizeConfigRow(config);
  return normalized.name?.trim() || reviewTypeLabel(normalized.review_type ?? "experience");
}

function reviewPeriodLabel(days: number | null | undefined, type?: ReviewType | null) {
  const options = type
    ? reviewPeriodOptionsForType(type)
    : [...EXPERIENCE_REVIEW_PERIOD_OPTIONS, ...PERFORMANCE_REVIEW_PERIOD_OPTIONS];
  const option = options.find((item) => item.days === days);
  return option?.label ?? (days ? `${days} dias` : "Periodo");
}

function addDaysToDate(dateValue: string, days: number) {
  const date = new Date(`${dateValue}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function daysBetween(fromDate: string, toDate: string) {
  const from = new Date(`${fromDate}T00:00:00`).getTime();
  const to = new Date(`${toDate}T00:00:00`).getTime();
  return Math.round((to - from) / 86_400_000);
}

function getEmployeeReviewType(employee: PerfEmployeeRow, today: string): ReviewType {
  return daysBetween(employee.admission_date, today) > EXPERIENCE_LIMIT_DAYS
    ? "performance"
    : "experience";
}

function reviewTypeLabel(type: ReviewType) {
  return type === "experience" ? "Experiencia" : "Desempenho";
}

function formatDateOnly(dateValue: string) {
  return new Date(`${dateValue}T00:00:00`).toLocaleDateString("pt-BR");
}

function SelectOptionsEditor({
  title = "Opções",
  options,
  onChange,
}: {
  title?: string;
  options: string[];
  onChange: (options: string[]) => void;
}) {
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [newOptionLabel, setNewOptionLabel] = useState("");

  const addOption = () => {
    const label = newOptionLabel.trim();
    if (!label) return;
    if (options.includes(label)) {
      toast.error("Esta opção já existe.");
      return;
    }
    onChange([...options, label]);
    setNewOptionLabel("");
  };

  const removeOption = (option: string) => {
    onChange(options.filter((current) => current !== option));
  };

  return (
    <div className="mt-4 border-t border-[#042558]/10 pt-4">
      <button
        type="button"
        title={title}
        onClick={() => setOptionsOpen((value) => !value)}
        className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-[#042558]/50 transition-colors hover:text-[#042558]"
      >
        {title} ({options.length})
        {optionsOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {optionsOpen && (
        <>
          <div className="mb-3 flex gap-2">
            <input
              value={newOptionLabel}
              onChange={(event) => setNewOptionLabel(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && (event.preventDefault(), addOption())}
              placeholder="Nova opção..."
              className={inputClass}
            />
            <button
              type="button"
              onClick={addOption}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#042558]/20 bg-white/60 px-3 py-2 text-sm font-medium text-[#042558] transition-all hover:bg-[#042558] hover:text-white hover:shadow-lg hover:shadow-[#042558]/20"
            >
              <Plus className="h-3.5 w-3.5" /> Adicionar
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {options.map((option) => (
              <span
                key={option}
                className="inline-flex items-center gap-2 rounded-full border border-[#042558]/20 bg-white/60 px-3 py-1 text-sm text-[#042558]"
              >
                {option}
                <button
                  type="button"
                  onClick={() => removeOption(option)}
                  aria-label="Excluir opção"
                  className="text-[#042558]/40 transition-colors hover:text-red-600"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function PerformanceAgendaPanel({ projectId }: { projectId: string }) {
  const { user } = useCurrentUser();
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [employees, setEmployees] = useState<PerfEmployeeRow[]>([]);
  const [descriptions, setDescriptions] = useState<DcRow[]>([]);
  const [configs, setConfigs] = useState<ConfigRow[]>([]);
  const [baseFields, setBaseFields] = useState<BaseFieldRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [
      { data: revs },
      { data: pos },
      { data: emps },
      { data: dcs },
      { data: cfgs },
      { data: fields },
    ] = await Promise.all([
      supabase
        .from("performance_reviews")
        .select("*")
        .eq("project_id", projectId)
        .order("due_date", { ascending: true }),
      supabase
        .from("project_positions")
        .select("id,nome,parent_id")
        .eq("project_id", projectId)
        .eq("status", "active")
        .order("display_order"),
      supabase
        .from("project_employees")
        .select(
          "id,project_id,position_id,area_id,sector_id,superior_imediato_id,nome,admission_date,last_performance_review_date",
        )
        .eq("project_id", projectId)
        .order("nome"),
      supabase.from("descricoes_cargo").select("*").eq("project_id", projectId),
      supabase
        .from("performance_review_configs")
        .select("*")
        .eq("project_id", projectId)
        .eq("is_active", true)
        .order("period_days", { ascending: true }),
      supabase
        .from("base_fields")
        .select("field_key,label,section,base_options(label,value,is_active)")
        .eq("project_id", projectId)
        .eq("is_active", true),
    ]);
    setReviews(toReviewRows(revs));
    setPositions((pos ?? []) as PositionRow[]);
    setEmployees((emps ?? []) as PerfEmployeeRow[]);
    setDescriptions((dcs ?? []) as DcRow[]);
    setConfigs(toConfigRows(cfgs));
    setBaseFields((fields ?? []) as BaseFieldRow[]);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const today = new Date().toISOString().slice(0, 10);
  const agendaItems = useMemo<AgendaItem[]>(() => {
    return employees
      .flatMap((employee) => {
        const leader = employees.find((item) => item.id === employee.superior_imediato_id) ?? null;
        const employeePosition =
          positions.find((position) => position.id === employee.position_id) ?? null;
        const description =
          descriptions.find((dc) => dc.organization_position_id === employee.position_id) ?? null;
        const reviewType = getEmployeeReviewType(employee, today);
        const config =
          configs.find((item) => (item.review_type ?? "experience") === reviewType) ?? null;
        const reviewPeriods = reviewPeriodOptionsForType(reviewType);
        if (!config) return [];
        return reviewPeriods.map(({ days: periodDays }) => {
          const baseDate = employee.last_performance_review_date || employee.admission_date;
          const dueDate = addDaysToDate(baseDate, periodDays);
          const existingReview =
            reviews.find(
              (review) =>
                review.employee_id === employee.id &&
                (review.config_id === config.id || review.review_type === reviewType) &&
                (review.review_type ?? reviewType) === reviewType &&
                review.due_date === dueDate,
            ) ?? null;
          return {
            id: `${employee.id}:${config.id}:${periodDays}:${dueDate}`,
            employee,
            leader,
            employeePosition,
            description,
            config,
            periodDays,
            baseDate,
            dueDate,
            daysUntil: daysBetween(today, dueDate),
            existingReview,
            reviewType,
          };
        });
      })
      .filter((item) => !item.existingReview || item.existingReview.status !== "finalized")
      .sort(
        (a, b) =>
          a.dueDate.localeCompare(b.dueDate) ||
          a.employee.nome.localeCompare(b.employee.nome, "pt-BR"),
      );
  }, [configs, descriptions, employees, positions, reviews, today]);

  const normalizedQuery = query.trim().toLowerCase();
  const groupedAgenda = useMemo(() => {
    const filtered = normalizedQuery
      ? agendaItems.filter((item) => {
          const text = [
            item.employee.nome,
            item.employeePosition?.nome,
            item.leader?.nome,
            reviewPeriodLabel(item.periodDays, item.reviewType),
            reviewTypeLabel(item.reviewType),
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return text.includes(normalizedQuery);
        })
      : agendaItems;
    const byEmployee = new Map<string, AgendaItem[]>();
    filtered.forEach((item) => {
      byEmployee.set(item.employee.id, [...(byEmployee.get(item.employee.id) ?? []), item]);
    });
    return Array.from(byEmployee.values()).sort((a, b) =>
      a[0].employee.nome.localeCompare(b[0].employee.nome, "pt-BR"),
    );
  }, [agendaItems, normalizedQuery]);

  const createAgendaReview = async (item: AgendaItem) => {
    try {
      if (item.existingReview) return;
      if (!item.leader) return toast.error("Cadastre o lider imediato deste funcionario primeiro.");
      if (!item.description)
        return toast.error("Este funcionario nao possui descricao de cargo vinculada.");
      const leaderPosition =
        positions.find((position) => position.id === item.leader?.position_id) ?? null;
      if (!item.employeePosition || !leaderPosition)
        return toast.error("Colaborador ou lider invalido.");
      const questions = buildReviewQuestions(
        item.config.questions_schema ?? [],
        item.description,
        item.reviewType,
        baseFields,
      );
      const expires_at = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

      const { data: review, error } = await supabase
        .from("performance_reviews")
        .insert({
          project_id: projectId,
          config_id: item.config.id,
          employee_id: item.employee.id,
          name: `${reviewTypeLabel(item.reviewType)} - ${item.employee.nome}`,
          employee_position_id: item.employee.position_id,
          leader_position_id: item.leader.position_id,
          job_description_id: item.description.id,
          employee_name: item.employee.nome,
          leader_name: item.leader.nome,
          job_title: item.description.cargo || item.employeePosition.nome,
          period_name: reviewPeriodLabel(item.periodDays, item.reviewType),
          period_days: item.periodDays,
          due_date: item.dueDate,
          review_type: item.reviewType,
          job_description_snapshot: toJson(item.description),
          activities_snapshot: toJson([]),
          questions_snapshot: toJson(questions),
          created_by: user?.id ?? null,
        })
        .select("id")
        .single();
      if (error || !review) return toast.error(error?.message ?? "Nao foi possivel criar.");
      const { error: partErr } = await supabase.from("performance_review_participants").insert([
        {
          review_id: review.id,
          project_id: projectId,
          participant_type: "collaborator",
          expires_at,
        },
        { review_id: review.id, project_id: projectId, participant_type: "leader", expires_at },
      ]);
      if (partErr) return toast.error(partErr.message);
      toast.success("Avaliacao criada na agenda");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel criar.");
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[#042558]">
            Agenda de avaliacoes
          </h2>
          <p className="mt-1 text-xs text-[#042558]/50">
            Organizada por pessoa. Ate 90 dias entra como experiencia; depois disso entra como
            desempenho.
          </p>
        </div>
        <span className="w-fit rounded-full bg-[#042558]/10 px-3 py-1 text-xs font-medium text-[#042558]">
          {agendaItems.filter((item) => item.daysUntil <= 0 && !item.existingReview).length}{" "}
          notificacao(oes)
        </span>
      </div>

      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className={inputClass}
        placeholder="Pesquisar pessoa, cargo, lider ou modelo"
      />

      {loading ? (
        <div className="rounded-xl border border-[#042558]/10 bg-white/60 p-8 text-center text-sm text-[#042558]/45">
          Carregando agenda...
        </div>
      ) : configs.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-[#042558]/15 p-8 text-center text-sm text-[#042558]/45">
          Nenhum modelo ativo. Ative os modelos que devem entrar na agenda.
        </div>
      ) : groupedAgenda.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-[#042558]/15 p-8 text-center text-sm text-[#042558]/45">
          Nenhuma pessoa encontrada na agenda.
        </div>
      ) : (
        <div className="space-y-3">
          {groupedAgenda.map((items) => {
            const employee = items[0].employee;
            const position = items[0].employeePosition;
            const dueCount = items.filter(
              (item) => item.daysUntil <= 0 && !item.existingReview,
            ).length;
            return (
              <article
                key={employee.id}
                className="rounded-xl border border-[#042558]/10 bg-white p-4"
              >
                <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h3 className="font-semibold text-[#042558]">{employee.nome}</h3>
                    <p className="text-xs text-[#042558]/50">
                      {position?.nome ?? "sem cargo"} · {reviewTypeLabel(items[0].reviewType)} ·
                      base:{" "}
                      {formatDateOnly(
                        employee.last_performance_review_date || employee.admission_date,
                      )}
                      {employee.last_performance_review_date
                        ? " (ultima avaliacao)"
                        : " (admissao)"}
                    </p>
                  </div>
                  {dueCount > 0 && (
                    <span className="w-fit rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                      {dueCount} pendente(s)
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  {items.map((item) => {
                    const isDue = item.daysUntil <= 0 && !item.existingReview;
                    return (
                      <div
                        key={item.id}
                        className={`flex flex-col gap-3 rounded-lg border px-3 py-2 md:flex-row md:items-center md:justify-between ${
                          isDue
                            ? "border-amber-300 bg-amber-50"
                            : "border-[#042558]/10 bg-[#042558]/[0.02]"
                        }`}
                      >
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-[#042558]">
                              {reviewTypeLabel(item.reviewType)} ·{" "}
                              {reviewPeriodLabel(item.periodDays, item.reviewType)}
                            </span>
                            {item.existingReview ? (
                              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                                Avaliacao criada
                              </span>
                            ) : isDue ? (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                                {item.daysUntil === 0
                                  ? "Vence hoje"
                                  : `${Math.abs(item.daysUntil)} dia(s) em atraso`}
                              </span>
                            ) : (
                              <span className="rounded-full bg-[#042558]/5 px-2 py-0.5 text-xs text-[#042558]/55">
                                Em {item.daysUntil} dia(s)
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-[#042558]/50">
                            Prevista para {formatDateOnly(item.dueDate)} · Lider:{" "}
                            {item.leader?.nome ?? "sem lider cadastrado"}
                          </p>
                        </div>
                        {item.existingReview ? (
                          <a
                            href={`/projetos/${projectId}/avaliacao-desempenho/comparar/${item.existingReview.id}`}
                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#042558]/20 px-3 py-2 text-sm font-medium text-[#042558] hover:bg-[#042558]/5"
                          >
                            <SplitSquareVertical className="h-4 w-4" /> Abrir
                          </a>
                        ) : (
                          <button
                            type="button"
                            onClick={() => createAgendaReview(item)}
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#042558] px-3 py-2 text-sm font-medium text-white"
                          >
                            <Plus className="h-4 w-4" /> Gerar
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function PerformanceReviewsPanel({ projectId }: { projectId: string }) {
  const { user } = useCurrentUser();
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [employees, setEmployees] = useState<PerfEmployeeRow[]>([]);
  const [descriptions, setDescriptions] = useState<DcRow[]>([]);
  const [configs, setConfigs] = useState<ConfigRow[]>([]);
  const [baseFields, setBaseFields] = useState<BaseFieldRow[]>([]);
  const [configId, setConfigId] = useState("");
  const [name, setName] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [leaderEmployeeId, setLeaderEmployeeId] = useState("");
  const [days, setDays] = useState(14);
  const [reviewPeriodDays, setReviewPeriodDays] = useState(
    EXPERIENCE_REVIEW_PERIOD_OPTIONS[0].days,
  );
  const [reviewTypeTab, setReviewTypeTab] = useState<ReviewType>("experience");

  const load = useCallback(async () => {
    const [
      { data: revs },
      { data: parts },
      { data: pos },
      { data: emps },
      { data: dcs },
      { data: cfgs },
      { data: fields },
    ] = await Promise.all([
      supabase
        .from("performance_reviews")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false }),
      supabase.from("performance_review_participants").select("*").eq("project_id", projectId),
      supabase
        .from("project_positions")
        .select("id,nome,parent_id")
        .eq("project_id", projectId)
        .eq("status", "active")
        .order("display_order"),
      supabase
        .from("project_employees")
        .select(
          "id,project_id,position_id,area_id,sector_id,superior_imediato_id,nome,admission_date,last_performance_review_date",
        )
        .eq("project_id", projectId)
        .order("nome"),
      supabase.from("descricoes_cargo").select("*").eq("project_id", projectId),
      supabase
        .from("performance_review_configs")
        .select("*")
        .eq("project_id", projectId)
        .eq("is_active", true)
        .order("period_days", { ascending: true }),
      supabase
        .from("base_fields")
        .select("field_key,label,section,base_options(label,value,is_active)")
        .eq("project_id", projectId)
        .eq("is_active", true),
    ]);
    setReviews(toReviewRows(revs));
    setParticipants((parts ?? []) as ParticipantRow[]);
    setPositions((pos ?? []) as PositionRow[]);
    setEmployees((emps ?? []) as PerfEmployeeRow[]);
    setDescriptions((dcs ?? []) as DcRow[]);
    const rows = toConfigRows(cfgs);
    setConfigs(rows);
    setBaseFields((fields ?? []) as BaseFieldRow[]);
    setConfigId((current) => current || rows[0]?.id || "");
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedEmployee = employees.find((employee) => employee.id === employeeId) ?? null;
  const selectedLeader = employees.find((employee) => employee.id === leaderEmployeeId) ?? null;
  const employeePositionId = selectedEmployee?.position_id ?? "";
  const selectedDc =
    descriptions.find((dc) => dc.organization_position_id === employeePositionId) ?? null;
  const subordinateCountByLeader = employees.reduce((acc, employee) => {
    if (!employee.superior_imediato_id) return acc;
    acc.set(employee.superior_imediato_id, (acc.get(employee.superior_imediato_id) ?? 0) + 1);
    return acc;
  }, new Map<string, number>());
  const leaderEmployees = employees.filter(
    (employee) => (subordinateCountByLeader.get(employee.id) ?? 0) > 0,
  );
  const subordinateEmployees = leaderEmployeeId
    ? employees.filter((employee) => employee.superior_imediato_id === leaderEmployeeId)
    : [];
  const selectedEmployeeIsBelowLeader =
    !!selectedEmployee &&
    !!leaderEmployeeId &&
    selectedEmployee.superior_imediato_id === leaderEmployeeId;
  const today = new Date().toISOString().slice(0, 10);
  const selectedReviewType = selectedEmployee
    ? getEmployeeReviewType(selectedEmployee, today)
    : null;
  const formReviewType = selectedReviewType ?? reviewTypeTab;
  const availableConfigs = useMemo(
    () => configs.filter((config) => (config.review_type ?? "experience") === formReviewType),
    [configs, formReviewType],
  );
  const availableReviewPeriodOptions = reviewPeriodOptionsForType(formReviewType);
  const selectedConfig = availableConfigs.find((config) => config.id === configId) ?? null;
  const getEmployeeBaseDate = useCallback(
    (employee: PerfEmployeeRow) => employee.last_performance_review_date || employee.admission_date,
    [],
  );
  const expectedReviewDate =
    selectedEmployee && reviewPeriodDays
      ? addDaysToDate(getEmployeeBaseDate(selectedEmployee), reviewPeriodDays)
      : null;
  const reviewCounts = reviews.reduce(
    (acc, review) => {
      acc[review.review_type ?? "experience"] += 1;
      return acc;
    },
    { experience: 0, performance: 0 } as Record<ReviewType, number>,
  );
  const filteredReviews = reviews.filter(
    (review) => (review.review_type ?? "experience") === reviewTypeTab,
  );
  const agendaItems: AgendaItem[] = [];

  useEffect(() => {
    setEmployeeId((current) => {
      if (!current) return "";
      const employee = employees.find((item) => item.id === current);
      return employee?.superior_imediato_id === leaderEmployeeId ? current : "";
    });
  }, [employees, leaderEmployeeId]);

  useEffect(() => {
    if (availableConfigs.some((config) => config.id === configId)) return;
    setConfigId(availableConfigs[0]?.id ?? "");
  }, [availableConfigs, configId]);

  useEffect(() => {
    setConfigId(availableConfigs[0]?.id ?? "");
  }, [formReviewType, availableConfigs]);

  useEffect(() => {
    if (availableReviewPeriodOptions.some((option) => option.days === reviewPeriodDays)) return;
    setReviewPeriodDays(availableReviewPeriodOptions[0].days);
  }, [availableReviewPeriodOptions, reviewPeriodDays]);

  const createReview = async () => {
    try {
      if (!name.trim()) return toast.error("Informe o nome da avaliação.");
      if (!selectedEmployee || !selectedLeader) return toast.error("Informe colaborador e líder.");
      if (!selectedEmployeeIsBelowLeader)
        return toast.error("Selecione um colaborador que responda diretamente para este lider.");
      if (!selectedDc)
        return toast.error("Este colaborador não possui descrição de cargo vinculada.");
      if (!selectedConfig || !selectedConfig.is_active)
        return toast.error("Selecione um modelo ativo antes de criar.");
      const employeePosition = positions.find((p) => p.id === employeePositionId);
      const leaderPosition = positions.find((p) => p.id === selectedLeader.position_id);
      if (!employeePosition || !leaderPosition)
        return toast.error("Colaborador ou líder inválido.");

      const questions = buildReviewQuestions(
        selectedConfig.questions_schema ?? [],
        selectedDc,
        formReviewType,
        baseFields,
      );
      const expires_at = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

      const { data: review, error } = await supabase
        .from("performance_reviews")
        .insert({
          project_id: projectId,
          config_id: selectedConfig.id,
          employee_id: selectedEmployee.id,
          name: name.trim(),
          employee_position_id: employeePositionId,
          leader_position_id: selectedLeader.position_id,
          job_description_id: selectedDc.id,
          employee_name: selectedEmployee.nome,
          leader_name: selectedLeader.nome,
          job_title: selectedDc.cargo || employeePosition.nome,
          period_name: reviewPeriodLabel(reviewPeriodDays, formReviewType),
          period_days: reviewPeriodDays,
          due_date: expectedReviewDate,
          review_type: formReviewType,
          job_description_snapshot: toJson(selectedDc),
          activities_snapshot: toJson([]),
          questions_snapshot: toJson(questions),
          created_by: user?.id ?? null,
        })
        .select("id")
        .single();
      if (error || !review) return toast.error(error?.message ?? "Não foi possível criar.");

      const { error: partErr } = await supabase.from("performance_review_participants").insert([
        {
          review_id: review.id,
          project_id: projectId,
          participant_type: "collaborator",
          expires_at,
        },
        { review_id: review.id, project_id: projectId, participant_type: "leader", expires_at },
      ]);
      if (partErr) return toast.error(partErr.message);
      setName("");
      setEmployeeId("");
      setLeaderEmployeeId("");
      toast.success("Avaliação criada");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel criar.");
    }
  };

  const prepareAgendaReview = async (_item: AgendaItem) => undefined;

  const markSentAndCopy = async (participant: ParticipantRow) => {
    const url = `${window.location.origin}/avaliacao-desempenho/preencher/${participant.token}`;
    try {
      await navigator.clipboard.writeText(url);
      if (participant.status === "not_sent") {
        await supabase
          .from("performance_review_participants")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", participant.id);
      }
      toast.success("Link copiado");
      await load();
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  };

  return (
    <div className="space-y-5">
      <section className="hidden">
        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[#042558]">
              Agenda de avaliações
            </h2>
            <p className="mt-1 text-xs text-[#042558]/50">
              Datas calculadas pela última avaliação do funcionário ou, se não houver, pela
              admissão.
            </p>
          </div>
          <span className="rounded-full bg-[#042558]/10 px-3 py-1 text-xs font-medium text-[#042558]">
            {agendaItems.filter((item) => item.daysUntil <= 0 && !item.existingReview).length}{" "}
            notificação(ões)
          </span>
        </div>

        {configs.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-[#042558]/15 p-6 text-center text-sm text-[#042558]/45">
            Nenhum modelo ativo. Ative os modelos que devem entrar na agenda.
          </div>
        ) : agendaItems.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-[#042558]/15 p-6 text-center text-sm text-[#042558]/45">
            Nenhuma avaliação prevista para os modelos ativos.
          </div>
        ) : (
          <div className="space-y-2">
            {agendaItems.slice(0, 12).map((item) => {
              const isDue = item.daysUntil <= 0 && !item.existingReview;
              const isToday = item.daysUntil === 0;
              return (
                <div
                  key={item.id}
                  className={`flex flex-col gap-3 rounded-xl border p-3 md:flex-row md:items-center md:justify-between ${
                    isDue ? "border-amber-300 bg-amber-50" : "border-[#042558]/10 bg-white"
                  }`}
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-[#042558]">{item.employee.nome}</p>
                      <span className="rounded-full bg-[#042558]/10 px-2 py-0.5 text-xs text-[#042558]">
                        {reviewPeriodLabel(item.periodDays, item.reviewType)}
                      </span>
                      {item.existingReview ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                          Avaliação criada
                        </span>
                      ) : isDue ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                          {isToday ? "Vence hoje" : `${Math.abs(item.daysUntil)} dia(s) em atraso`}
                        </span>
                      ) : (
                        <span className="rounded-full bg-[#042558]/5 px-2 py-0.5 text-xs text-[#042558]/55">
                          Em {item.daysUntil} dia(s)
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-[#042558]/50">
                      Prevista para {formatDateOnly(item.dueDate)} · base:{" "}
                      {formatDateOnly(item.baseDate)}
                      {item.employee.last_performance_review_date
                        ? " (ultima avaliação)"
                        : " (admissão)"}
                    </p>
                    <p className="mt-1 text-xs text-[#042558]/45">
                      Lider: {item.leader?.nome ?? "sem lider cadastrado"} · Cargo:{" "}
                      {item.employeePosition?.nome ?? "sem cargo"}
                    </p>
                  </div>
                  {item.existingReview ? (
                    <a
                      href={`/projetos/${projectId}/avaliacao-desempenho/comparar/${item.existingReview.id}`}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#042558]/20 px-3 py-2 text-sm font-medium text-[#042558] hover:bg-[#042558]/5"
                    >
                      <SplitSquareVertical className="h-4 w-4" /> Abrir
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => prepareAgendaReview(item)}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#042558] px-3 py-2 text-sm font-medium text-white"
                    >
                      <Plus className="h-4 w-4" /> Preparar
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="border-b border-[#042558]/10 pb-1">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[#042558]">
              Tipo de avaliacao
            </h2>
            <p className="mt-1 text-xs text-[#042558]/50">
              A separacao e feita automaticamente pela data de admissao do funcionario.
            </p>
          </div>
          <div className="flex min-w-fit gap-6">
            {(["experience", "performance"] as ReviewType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setReviewTypeTab(type)}
                className={`relative pb-3 text-sm font-semibold transition ${
                  reviewTypeTab === type
                    ? "text-[#042558]"
                    : "text-[#042558]/40 hover:text-[#042558]/70"
                }`}
              >
                {type === "experience" ? "Avaliacao de experiencia" : "Avaliacao de desempenho"}
                <span
                  className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${
                    reviewTypeTab === type
                      ? "bg-[#042558]/10 text-[#042558]"
                      : "bg-[#042558]/5 text-[#042558]/45"
                  }`}
                >
                  {reviewCounts[type]}
                </span>
                {reviewTypeTab === type && (
                  <span className="absolute bottom-0 left-0 h-0.5 w-full rounded-full bg-[#042558]" />
                )}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[#042558]/10 bg-white/70 p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[#042558]">
          Nova avaliacao
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[#042558]/70">
              Nome da avaliacao
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              placeholder="Ex: Avaliacao semestral"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[#042558]/70">
              Lider avaliador
            </span>
            <select
              value={leaderEmployeeId}
              onChange={(e) => setLeaderEmployeeId(e.target.value)}
              className={inputClass}
            >
              <option value="">Selecione</option>
              {leaderEmployees.map((employee) => {
                const position = positions.find((item) => item.id === employee.position_id);
                const count = subordinateCountByLeader.get(employee.id) ?? 0;
                return (
                  <option key={employee.id} value={employee.id}>
                    {employee.nome} - {position?.nome ?? "sem cargo"} - {count} subordinado(s)
                  </option>
                );
              })}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[#042558]/70">
              Colaborador avaliado
            </span>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className={inputClass}
              disabled={!leaderEmployeeId}
            >
              <option value="">
                {leaderEmployeeId ? "Selecione" : "Selecione o lider primeiro"}
              </option>
              {subordinateEmployees.map((employee) => {
                const position = positions.find((item) => item.id === employee.position_id);
                const hasDescription = descriptions.some(
                  (dc) => dc.organization_position_id === employee.position_id,
                );
                return (
                  <option key={employee.id} value={employee.id} disabled={!hasDescription}>
                    {employee.nome} - {position?.nome ?? "sem cargo"}
                    {!hasDescription ? " - sem descricao de cargo" : ""}
                  </option>
                );
              })}
              {leaderEmployeeId && subordinateEmployees.length === 0 && (
                <option value="" disabled>
                  Nenhum funcionario cadastrado abaixo deste lider
                </option>
              )}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[#042558]/70">
              Dia da avaliacao
            </span>
            <select
              value={reviewPeriodDays}
              onChange={(e) => setReviewPeriodDays(Number(e.target.value))}
              className={inputClass}
            >
              {availableReviewPeriodOptions.map((option) => (
                <option key={option.days} value={option.days}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[#042558]/70">
              Validade dos links
            </span>
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className={inputClass}
            >
              <option value={7}>7 dias</option>
              <option value={14}>14 dias</option>
              <option value={30}>30 dias</option>
            </select>
          </label>
        </div>
        {employeePositionId && !selectedDc && (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Este colaborador não possui descrição de cargo vinculada.
          </p>
        )}
        {selectedEmployee && selectedConfig && expectedReviewDate && (
          <p className="mt-3 rounded-lg border border-[#042558]/10 bg-[#042558]/5 px-3 py-2 text-sm text-[#042558]/70">
            {selectedReviewType ? `${reviewTypeLabel(selectedReviewType)} · ` : ""}
            Data prevista: {formatDateOnly(expectedReviewDate)} (
            {reviewPeriodLabel(reviewPeriodDays, formReviewType)} apos a data base de{" "}
            {formatDateOnly(getEmployeeBaseDate(selectedEmployee))}).
          </p>
        )}
        {selectedDc && (
          <p className="mt-3 text-sm text-[#042558]/60">
            Descrição vinculada: {selectedDc.cargo || "sem cargo"}.
          </p>
        )}
        <button
          onClick={createReview}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#042558] px-4 py-2 text-sm font-medium text-white"
        >
          <Plus className="h-4 w-4" /> Criar avaliacao
        </button>
      </section>

      <section className="space-y-3">
        {filteredReviews.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-[#042558]/15 p-8 text-center text-sm text-[#042558]/40">
            Nenhuma avaliação criada.
          </div>
        ) : (
          filteredReviews.map((review) => {
            const ps = participants.filter((p) => p.review_id === review.id);
            const collaborator = ps.find((p) => p.participant_type === "collaborator");
            const leader = ps.find((p) => p.participant_type === "leader");
            const collaboratorAnswered = collaborator?.status === "answered";
            const leaderAnswered = leader?.status === "answered";
            const bothAnswered = collaboratorAnswered && leaderAnswered;
            return (
              <article
                key={review.id}
                className={`rounded-xl border p-4 shadow-sm transition-colors ${
                  bothAnswered
                    ? "border-emerald-200 bg-emerald-50/80 shadow-emerald-100/60"
                    : "border-[#042558]/10 bg-white"
                }`}
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h3 className="font-semibold text-[#042558]">{review.name}</h3>
                    <p className="mt-1 text-sm text-[#042558]/60">
                      {review.employee_name} · {review.job_title} · Líder: {review.leader_name}
                    </p>
                    {(review.period_name || review.due_date) && (
                      <p className="mt-1 text-xs text-[#042558]/45">
                        {review.review_type ? `${reviewTypeLabel(review.review_type)} - ` : ""}
                        {review.period_name ?? "Periodo"}{" "}
                        {review.due_date
                          ? `- prevista para ${formatDateOnly(review.due_date)}`
                          : ""}
                      </p>
                    )}
                    <span className="mt-2 inline-flex rounded-full bg-[#042558]/10 px-2 py-0.5 text-xs font-medium text-[#042558]">
                      {REVIEW_STATUS_LABEL[review.status]}
                    </span>
                  </div>
                  <a
                    href={`/projetos/${projectId}/avaliacao-desempenho/comparar/${review.id}`}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#042558] px-3 py-2 text-sm font-medium text-white"
                  >
                    <SplitSquareVertical className="h-4 w-4" /> Comparar avaliações
                  </a>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <ParticipantCard
                    title="Colaborador"
                    participant={collaborator}
                    onCopy={markSentAndCopy}
                  />
                  <ParticipantCard title="Líder" participant={leader} onCopy={markSentAndCopy} />
                </div>
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}

function ParticipantCard({
  title,
  participant,
  onCopy,
}: {
  title: string;
  participant?: ParticipantRow;
  onCopy: (participant: ParticipantRow) => void;
}) {
  const answered = participant?.status === "answered";
  return (
    <div
      className={`rounded-lg border p-3 transition-colors ${
        answered ? "border-emerald-200 bg-emerald-50" : "border-[#042558]/10 bg-[#042558]/5"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p
            className={`text-xs font-semibold uppercase tracking-wider ${
              answered ? "text-emerald-700/70" : "text-[#042558]/50"
            }`}
          >
            {title}
          </p>
          <p className={`text-sm font-medium ${answered ? "text-emerald-900" : "text-[#042558]"}`}>
            {participant ? STATUS_LABEL[participant.status] : "Link não gerado"}
          </p>
        </div>
        {participant ? (
          <button
            onClick={() => onCopy(participant)}
            className={`inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-xs font-medium ${
              answered
                ? "border-emerald-200 text-emerald-800 hover:bg-emerald-100"
                : "border-[#042558]/20 text-[#042558] hover:bg-[#042558]/5"
            }`}
          >
            <Copy className="h-3.5 w-3.5" /> Enviar link
          </button>
        ) : (
          <span className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
            Recrie a avaliação
          </span>
        )}
      </div>
      {participant?.submitted_at && (
        <p className={`mt-2 text-xs ${answered ? "text-emerald-700/70" : "text-[#042558]/50"}`}>
          Respondido {new Date(participant.submitted_at).toLocaleString("pt-BR")}
        </p>
      )}
      {participant && (
        <p
          className={`mt-2 break-all text-[11px] ${
            answered ? "text-emerald-800/55" : "text-[#042558]/45"
          }`}
        >
          /avaliacao-desempenho/preencher/{participant.token}
        </p>
      )}
    </div>
  );
}

function AnswerCell({
  title,
  participant,
  question,
  canEdit,
  onChange,
}: {
  title: string;
  participant: ParticipantRow | null;
  question: PerformanceQuestion;
  canEdit: boolean;
  onChange: (participant: ParticipantRow, questionKey: string, nextAnswer: string) => void;
}) {
  const value = participant?.response_answers?.[question.id] ?? "";
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#042558]/50">
        {title}
      </p>
      {!participant || participant.status !== "answered" ? (
        <p className="rounded-lg bg-[#042558]/5 p-3 text-sm italic text-[#042558]/40">
          sem resposta
        </p>
      ) : canEdit ? (
        <QuestionInput
          question={question}
          participantType={participant.participant_type}
          value={value}
          onChange={(next) => onChange(participant, question.id, next)}
        />
      ) : (
        <p className="min-h-[42px] whitespace-pre-wrap rounded-lg bg-[#042558]/5 p-3 text-sm text-[#042558]">
          {value || <span className="italic text-[#042558]/40">sem resposta</span>}
        </p>
      )}
    </div>
  );
}

function QuestionInput({
  question,
  participantType,
  value,
  onChange,
}: {
  question: PerformanceQuestion;
  participantType?: ParticipantType;
  value: string;
  onChange: (value: string) => void;
}) {
  if (question.type === "select") {
    const options = questionOptions(question, participantType);
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
        <option value="">Selecione</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }
  if (question.type === "textarea") {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        className={inputClass}
      />
    );
  }
  return <input value={value} onChange={(e) => onChange(e.target.value)} className={inputClass} />;
}

function CommentBox({
  questionKey,
  comments,
  authors,
  disabled,
  onAdd,
}: {
  questionKey: string;
  comments: CommentRow[];
  authors: Record<string, string>;
  disabled: boolean;
  onAdd: (questionKey: string, content: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center gap-1 rounded-lg border border-[#042558]/20 px-3 py-2 text-xs font-medium text-[#042558] hover:bg-[#042558]/5"
      >
        <MessageSquare className="h-3.5 w-3.5" /> Comentários{" "}
        {comments.length > 0 ? `(${comments.length})` : ""}
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-10 w-80 rounded-xl border border-[#042558]/10 bg-white p-3 shadow-xl">
          <div className="max-h-56 space-y-2 overflow-y-auto">
            {comments.length === 0 && (
              <p className="text-xs italic text-[#042558]/40">Sem comentários.</p>
            )}
            {comments.map((comment) => (
              <div key={comment.id} className="rounded-lg border border-[#042558]/10 p-2 text-xs">
                <div className="mb-1 flex justify-between gap-2 text-[#042558]/50">
                  <span>{authors[comment.author_id] ?? "Autor"}</span>
                  <span>{new Date(comment.created_at).toLocaleString("pt-BR")}</span>
                </div>
                <p className="whitespace-pre-wrap text-[#042558]">{comment.content}</p>
              </div>
            ))}
          </div>
          {!disabled && (
            <div className="mt-3 space-y-2">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={3}
                className={inputClass}
                placeholder="Adicionar comentário"
              />
              <button
                onClick={() => {
                  if (text.trim()) {
                    onAdd(questionKey, text.trim());
                    setText("");
                  }
                }}
                className="w-full rounded-lg bg-[#042558] px-3 py-2 text-xs font-medium text-white"
              >
                Adicionar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function HistoryList({
  history,
  authors,
}: {
  history: HistoryRow[];
  authors: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  if (!history.length) return null;
  return (
    <div className="mt-3 border-t border-[#042558]/10 pt-3">
      <button
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center gap-1 text-xs font-medium text-[#042558]/60 hover:text-[#042558]"
      >
        <History className="h-3.5 w-3.5" /> Histórico ({history.length})
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {history.map((item) => (
            <div key={item.id} className="rounded-lg bg-[#042558]/5 p-3 text-xs text-[#042558]/70">
              <p>
                {authors[item.changed_by ?? ""] ?? "Usuário"} ·{" "}
                {new Date(item.changed_at).toLocaleString("pt-BR")}
              </p>
              <p className="mt-1">Anterior: {item.previous_answer || "sem resposta"}</p>
              <p>Atual: {item.new_answer || "sem resposta"}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TabButton({
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
      className={`relative pb-3 text-sm font-medium transition ${active ? "text-[#042558]" : "text-[#042558]/40 hover:text-[#042558]/70"}`}
    >
      {children}
      {active && (
        <span className="absolute bottom-0 left-0 h-0.5 w-full rounded-full bg-[#042558]" />
      )}
    </button>
  );
}

function getDescendantPositionIds(positions: PositionRow[], leaderId: string) {
  const result = new Set<string>();
  const visit = (parentId: string) => {
    positions
      .filter((position) => position.parent_id === parentId)
      .forEach((child) => {
        result.add(child.id);
        visit(child.id);
      });
  };
  visit(leaderId);
  return result;
}

export function allReviewQuestions(review: ReviewRow) {
  return [...((review.questions_snapshot ?? []) as PerformanceQuestion[])].filter(
    (q) => q.active ?? true,
  );
}

type PublicQuestionBlock =
  | { kind: "question"; id: string; question: PerformanceQuestion }
  | { kind: "group"; id: string; title: string; questions: PerformanceQuestion[] };

function publicQuestionSections(questions: PerformanceQuestion[]) {
  const sections: Array<{ title: string; blocks: PublicQuestionBlock[] }> = [];
  const getSection = (title: string) => {
    let section = sections.find((item) => item.title === title);
    if (!section) {
      section = { title, blocks: [] };
      sections.push(section);
    }
    return section;
  };

  questions.forEach((question) => {
    const section = getSection(question.sectionTitle ?? "");
    if (!question.groupId) {
      section.blocks.push({ kind: "question", id: question.id, question });
      return;
    }
    const groupId = `${question.sectionTitle ?? ""}:${question.groupId}`;
    const existing = section.blocks.find(
      (block): block is Extract<PublicQuestionBlock, { kind: "group" }> =>
        block.kind === "group" && block.id === groupId,
    );
    if (existing) {
      existing.questions.push(question);
    } else {
      section.blocks.push({
        kind: "group",
        id: groupId,
        title: question.groupTitle ?? question.helpText ?? "Item",
        questions: [question],
      });
    }
  });

  return sections;
}

function displayGroupTitle(block: Extract<PublicQuestionBlock, { kind: "group" }>) {
  if (block.title && !isInternalOptionValue(block.title)) return block.title;
  const firstQuestion = block.questions[0];
  const sourceLabel: Record<string, string> = {
    activities: "Atividade",
    indicators: "Indicador",
    culture_skills: "Habilidade",
    role_skills: "Habilidade",
    behavior: "Postura e comportamento",
  };
  const suffix = firstQuestion?.groupId?.match(/_(\d+)$/)?.[1];
  return `${sourceLabel[firstQuestion?.dynamicSource ?? ""] ?? "Item"}${suffix ? ` ${suffix}` : ""}`;
}

export function PublicPerformanceFormFields({
  questions,
  participantType,
  answers,
  onChange,
}: {
  questions: PerformanceQuestion[];
  participantType: ParticipantType;
  answers: Record<string, string>;
  onChange: (answers: Record<string, string>) => void;
}) {
  const activeQuestions = useMemo(() => questions.filter((q) => q.active ?? true), [questions]);
  const sections = useMemo(() => publicQuestionSections(activeQuestions), [activeQuestions]);
  return (
    <div className="space-y-5">
      {sections.map((section) => (
        <section key={section.title || "geral"} className="space-y-3">
          {section.title && (
            <h2 className="border-b border-gray-200 pb-2 text-sm font-bold uppercase tracking-wide text-[#042558]">
              {section.title}
            </h2>
          )}
          {section.blocks.map((block) =>
            block.kind === "group" ? (
              <div key={block.id} className="rounded-xl border border-gray-200 bg-gray-50/60 p-4">
                <p className="mb-3 whitespace-pre-wrap text-sm font-semibold text-gray-800">
                  {displayGroupTitle(block)}
                </p>
                <div className="grid gap-3 md:grid-cols-2">
                  {block.questions.map((question) => (
                    <label key={question.id} className="block">
                      <span className="mb-1 block text-sm font-medium text-gray-700">
                        {displayQuestionLabel(question, participantType)}{" "}
                        {question.required && <span className="text-red-500">*</span>}
                      </span>
                      <QuestionInput
                        question={question}
                        participantType={participantType}
                        value={answers[question.id] ?? ""}
                        onChange={(value) => onChange({ ...answers, [question.id]: value })}
                      />
                    </label>
                  ))}
                </div>
              </div>
            ) : (
              <label
                key={block.id}
                className="block rounded-xl border border-gray-200 bg-gray-50/60 p-4"
              >
                <span className="mb-1 block text-sm font-semibold text-gray-700">
                  {displayQuestionLabel(block.question, participantType)}{" "}
                  {block.question.required && <span className="text-red-500">*</span>}
                </span>
                {block.question.helpText && (
                  <span className="mb-2 block text-xs text-gray-400">
                    {block.question.helpText}
                  </span>
                )}
                <QuestionInput
                  question={block.question}
                  participantType={participantType}
                  value={answers[block.question.id] ?? ""}
                  onChange={(value) => onChange({ ...answers, [block.question.id]: value })}
                />
              </label>
            ),
          )}
        </section>
      ))}
    </div>
  );
}

export function validatePerformanceAnswers(
  questions: PerformanceQuestion[],
  answers: Record<string, string>,
  participantType: ParticipantType = "collaborator",
) {
  const missing = questions.find(
    (question) => (question.active ?? true) && question.required && !answers[question.id]?.trim(),
  );
  return missing ? `Preencha: ${displayQuestionLabel(missing, participantType)}` : null;
}
