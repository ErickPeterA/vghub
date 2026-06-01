export type InstrucaoItem = { requisito: string; nivel: string; area: string };
export type ExperienciaItem = { requisito: string; tempo: string; tipo: string; area: string };
export type ConhecimentoItem = { requisito: string; tecnico: string; descricao: string; nivel: string };
export type AtividadeItem = { macroprocesso: string; sn: string; atividade: string; periodicidade: string };
export type IndicadorItem = { nome: string; meta: string };
export type HabilidadeItem = { nome: string; descricao: string };
export type PosturaItem = { nome: string };

export const empty = {
  instrucao: (): InstrucaoItem => ({ requisito: "", nivel: "", area: "" }),
  experiencia: (): ExperienciaItem => ({ requisito: "", tempo: "", tipo: "", area: "" }),
  conhecimento: (): ConhecimentoItem => ({ requisito: "", tecnico: "", descricao: "", nivel: "" }),
  atividade: (): AtividadeItem => ({ macroprocesso: "", sn: "", atividade: "", periodicidade: "" }),
  indicador: (): IndicadorItem => ({ nome: "", meta: "" }),
  habilidade: (): HabilidadeItem => ({ nome: "", descricao: "" }),
  postura: (): PosturaItem => ({ nome: "" }),
};

export type DescricaoCargo = {
  id?: string;
  cargo: string;
  unidade_negocio: string;
  departamento: string;
  nivelamento: string;
  superior_imediato: string;
  tipo_carreira: string;
  data_versao: string;
  data_revisao: string;
  status: string;
  objetivo: string;
  instrucao: InstrucaoItem[];
  experiencia: ExperienciaItem[];
  conhecimento: ConhecimentoItem[];
  atividades: AtividadeItem[];
  indicadores: IndicadorItem[];
  habilidades_cargo: HabilidadeItem[];
  habilidades_culturais: HabilidadeItem[];
  postura: PosturaItem[];
};

export const emptyDC = (): DescricaoCargo => ({
  cargo: "",
  unidade_negocio: "",
  departamento: "",
  nivelamento: "",
  superior_imediato: "",
  tipo_carreira: "",
  data_versao: "",
  data_revisao: "",
  status: "rascunho",
  objetivo: "",
  instrucao: [],
  experiencia: [],
  conhecimento: [],
  atividades: [],
  indicadores: [],
  habilidades_cargo: [],
  habilidades_culturais: [],
  postura: [],
});
