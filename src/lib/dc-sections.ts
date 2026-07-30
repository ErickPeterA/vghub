// Blocos fixos da Descrição de Cargo. A configuração de campos de cada bloco
// vive em base_fields.section (valor = key abaixo).

export type DCSection = {
  key: string; // valor armazenado em base_fields.section
  num: string; // "01" .. "09"
  label: string; // título exibido
  repeater: boolean; // false = bloco de campos único; true = repeater
  itemSingular?: string; // rótulo singular para o botão "+ Adicionar X"
  arrayKey?: keyof import("./dc-types").DescricaoCargo; // chave do array em DescricaoCargo
};

export const DC_SECTIONS: DCSection[] = [
  { key: "Cabeçalho", num: "01", label: "Cabeçalho", repeater: false },
  {
    key: "Instrução",
    num: "02",
    label: "Instrução",
    repeater: true,
    itemSingular: "instrução",
    arrayKey: "instrucao",
  },
  {
    key: "Experiência",
    num: "03",
    label: "Experiência",
    repeater: true,
    itemSingular: "experiência",
    arrayKey: "experiencia",
  },
  {
    key: "Conhecimento",
    num: "04",
    label: "Conhecimento",
    repeater: true,
    itemSingular: "conhecimento",
    arrayKey: "conhecimento",
  },
  {
    key: "Atividades",
    num: "05",
    label: "Atividades",
    repeater: true,
    itemSingular: "atividade",
    arrayKey: "atividades",
  },
  {
    key: "Indicadores",
    num: "06",
    label: "Indicadores",
    repeater: true,
    itemSingular: "indicador",
    arrayKey: "indicadores",
  },
  {
    key: "Habilidades do Cargo",
    num: "07",
    label: "Habilidades do Cargo",
    repeater: true,
    itemSingular: "habilidade",
    arrayKey: "habilidades_cargo",
  },
  {
    key: "Habilidades Culturais",
    num: "08",
    label: "Habilidades Culturais",
    repeater: true,
    itemSingular: "habilidade cultural",
    arrayKey: "habilidades_culturais",
  },
  {
    key: "Postura & Comportamento",
    num: "09",
    label: "Postura & Comportamento",
    repeater: true,
    itemSingular: "postura",
    arrayKey: "postura",
  },
];

export const SECTION_KEYS = DC_SECTIONS.map((section) => section.key);
