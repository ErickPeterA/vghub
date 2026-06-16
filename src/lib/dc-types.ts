// Itens dos blocos repetidores são dinâmicos: cada chave corresponde a um
// field_key configurado em base_fields para aquela seção.
export type DynamicItem = Record<string, string | number | boolean | string[]>;

export const empty = {
  item: (): DynamicItem => ({}),
};

export type DescricaoCargo = {
  id?: string;
  // Cabeçalho — colunas fixas (mantidas por compatibilidade). Demais campos
  // do cabeçalho criados via base ficam em dynamic_values.
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
  // Blocos repetidores — agora armazenam itens dinâmicos
  instrucao: DynamicItem[];
  experiencia: DynamicItem[];
  conhecimento: DynamicItem[];
  atividades: DynamicItem[];
  indicadores: DynamicItem[];
  habilidades_cargo: DynamicItem[];
  habilidades_culturais: DynamicItem[];
  postura: DynamicItem[];
  // Campos extras do cabeçalho configurados via base
  dynamic_values: Record<string, string | number | boolean | string[]>;
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
  dynamic_values: {},
});
