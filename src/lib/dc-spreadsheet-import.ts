import * as XLSX from "xlsx";
import { DC_SECTIONS } from "@/lib/dc-sections";
import { emptyDC, type DescricaoCargo, type DynamicItem } from "@/lib/dc-types";
import type { DynamicField } from "@/components/DynamicFields";

const normalize = (value: unknown) =>
  String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const scalarKeys = new Set([
  "cargo",
  "unidade_negocio",
  "departamento",
  "nivelamento",
  "superior_imediato",
  "tipo_carreira",
  "data_versao",
  "data_revisao",
  "status",
  "objetivo",
]);

// Variações frequentes nos modelos enviados pelos clientes. As chaves continuam
// sendo as da Base do projeto, portanto a resposta é colocada no campo correto.
const FIELD_ALIASES: Record<string, string[]> = {
  cargo: [
    "cargo",
    "nome do cargo",
    "nomenclatura do cargo",
    "nomenclatura do cargo visivel",
    "titulo do cargo",
    "denominacao do cargo",
  ],
  unidade_negocio: ["area", "unidade de negocio", "unidade negocio"],
  departamento: ["setor", "departamento", "area de atuacao"],
  superior_imediato: ["superior imediato", "gestor imediato", "cargo do superior"],
  tipo_carreira: ["tipo de carreira", "carreira"],
  nivelamento: ["nivel", "nivelamento", "nivel do cargo"],
  objetivo: ["objetivo", "objetivo do cargo", "missao do cargo", "finalidade do cargo"],
  data_versao: ["data da versao", "versao"],
  data_revisao: ["data de revisao", "revisao"],
};

// Cabeçalho do modelo legado que foi fornecido para a importação. Esta leitura
// independe da configuração atual da Base e evita perder dados por diferenças
// apenas de nomenclatura entre os dois modelos.
const LEGACY_HEADER_FIELDS: Record<string, keyof DescricaoCargo> = {
  "nomenclatura do cargo": "cargo",
  "nome do cargo": "cargo",
  "tipo de carreira do cargo": "tipo_carreira",
  "cargo do superior imediato": "superior_imediato",
  "objetivo principal do cargo": "objetivo",
  "data de criacao do cargo": "data_versao",
  "data ultima revisao do cargo": "data_revisao",
};

type Parsed = { draft: DescricaoCargo; sheetName: string; mappedFields: number };

function putItem(
  draft: DescricaoCargo,
  key: keyof DescricaoCargo,
  item: DynamicItem,
  matched: Set<string>,
) {
  if (!Object.values(item).some((value) => value !== "" && value !== undefined)) return;
  (draft[key] as DynamicItem[]).push(item);
  Object.keys(item).forEach((field) => matched.add(field));
}

function value(row: unknown[] | undefined, column: number) {
  return String(row?.[column] ?? "").trim();
}

function checkboxState(raw: unknown): boolean | null {
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "number") return raw === 1 ? true : raw === 0 ? false : null;
  const normalized = normalize(raw);
  if (["true", "sim", "yes", "x", "checked", "marcado", "1"].includes(normalized)) return true;
  if (["false", "nao", "no", "unchecked", "desmarcado", "0"].includes(normalized)) return false;
  const text = String(raw ?? "").trim();
  if (/^(☑|☒|✓|✔|✅|\[x\])/i.test(text)) return true;
  if (/^(☐|□|\[\s*\])/i.test(text)) return false;
  return null;
}

function selectedOption(row: unknown[] | undefined, labelColumn: number, lastColumn: number) {
  const rawLabel = value(row, labelColumn);
  if (!rawLabel) return "";

  const stateInLabel = checkboxState(rawLabel);
  if (stateInLabel === false) return "";
  const nearbyStates = (row ?? [])
    .slice(labelColumn + 1, lastColumn + 1)
    .map(checkboxState)
    .filter((state): state is boolean => state !== null);
  if (nearbyStates.includes(false) && !nearbyStates.includes(true)) return "";

  return rawLabel
    .replace(/^(?:☑|☒|✓|✔|✅|☐|□|\[(?:x|\s*)\])\s*/i, "")
    .split(/\r?\n|\s+(?:[-–—])\s+|:\s+/u, 1)[0]
    .trim();
}

// Lê a estrutura da aba DC do modelo corporativo até a última linha útil. O
// restante do importador continua atendendo planilhas cujo layout já coincide
// diretamente com os campos configurados na Base.
function configuredFieldKey(
  fields: DynamicField[],
  section: string,
  fallback: string,
  label?: string,
) {
  const sectionFields = fields.filter((field) => normalize(field.section) === normalize(section));
  const normalizedLabel = normalize(label);
  const labelMatches = sectionFields.filter((field) => {
    const fieldLabel = normalize(field.label);
    return (
      normalizedLabel &&
      (fieldLabel === normalizedLabel ||
        (normalizedLabel.length >= 5 &&
          (fieldLabel.includes(normalizedLabel) || normalizedLabel.includes(fieldLabel))))
    );
  });
  return (
    labelMatches.find(
      (field) =>
        field.field_type === "single_select" || field.field_type === "competency_description",
    )?.field_key ??
    labelMatches[0]?.field_key ??
    sectionFields.find((field) => field.field_key === fallback)?.field_key ??
    sectionFields.find((field) => field.field_type === "competency_description")?.field_key ??
    fallback
  );
}

function parseLegacyDcTemplate(
  rows: unknown[][],
  draft: DescricaoCargo,
  matched: Set<string>,
  fields: DynamicField[],
) {
  const fieldKey = (section: string, fallback: string, label: string) =>
    configuredFieldKey(fields, section, fallback, label);
  const cargoName = value(rows[3], 1);
  const areaSetor = value(rows[3], 7);
  const headerValues: Array<[string, string]> = [
    ["area_setor", areaSetor],
    ["adicional", value(rows[5], 1)],
    ["disponibilidade_viagens", value(rows[5], 4)],
    ["veiculo_proprio", value(rows[5], 7)],
    ["cnh", value(rows[5], 10)],
  ];
  headerValues.forEach(([key, imported]) => {
    if (!imported) return;
    draft.dynamic_values[key] = imported;
    matched.add(key);
  });
  const headerSelections: Array<[string, string]> = [
    [fieldKey("Cabeçalho", "nivelamento", "Nivelamento do Cargo"), cargoName.split(/\s+/)[0] ?? ""],
    [fieldKey("Cabeçalho", "unidade_negocio", "Unidade de Negócio"), areaSetor],
    [fieldKey("Cabeçalho", "departamento", "Departamento"), areaSetor],
  ];
  headerSelections.forEach(([key, imported]) => {
    if (!imported) return;
    if (scalarKeys.has(key)) (draft as unknown as Record<string, unknown>)[key] = imported;
    else draft.dynamic_values[key] = imported;
    matched.add(key);
  });
  for (let row = 12; row < 16; row += 1) {
    if (value(rows[row], 1))
      putItem(
        draft,
        "instrucao",
        {
          [fieldKey("Instrução", "requisito_instrucao", "Requisito de Instrução")]: value(
            rows[row],
            0,
          ),
          [fieldKey("Instrução", "nivel_instrucao", "Nível da Instrução")]: value(rows[row], 1),
          [fieldKey("Instrução", "area_instrucao", "Se for o caso, área da Instrução")]: value(
            rows[row],
            3,
          ),
        },
        matched,
      );
    if (value(rows[row], 6) || value(rows[row], 7))
      putItem(
        draft,
        "experiencia",
        {
          [fieldKey("Experiência", "requisito_experiencia", "Requisito da Experiência")]: value(
            rows[row],
            6,
          ),
          [fieldKey("Experiência", "tempo_minimo", "Tempo mínimo necessário")]: value(rows[row], 7),
          [fieldKey("Experiência", "unidade_tempo", "Meses ou ano")]: value(rows[row], 8),
          [fieldKey("Experiência", "tipo_experiencia", "Que tipo de experiência?")]: value(
            rows[row],
            9,
          ),
          [fieldKey(
            "Experiência",
            "area_experiencia",
            'Se for "área", escrever que área necessita de experiência',
          )]: value(rows[row], 10),
        },
        matched,
      );
  }
  for (let row = 19; row < 27; row += 1)
    putItem(
      draft,
      "conhecimento",
      {
        [fieldKey(
          "Conhecimento",
          "requisito_conhecimento",
          "Qual o requisito deste conhecimento?",
        )]: value(rows[row], 1),
        [fieldKey("Conhecimento", "conhecimento_tecnico", "Qual o conhecimento técnico?")]: value(
          rows[row],
          3,
        ),
        [fieldKey("Conhecimento", "nivel_conhecimento", "Qual o nível de conhecimento?")]: value(
          rows[row],
          9,
        ),
      },
      matched,
    );
  for (let row = 29; row < 53; row += 1) {
    if (!value(rows[row], 1)) continue;
    putItem(
      draft,
      "atividades",
      {
        atividade_principal: value(rows[row], 0),
        atividade: value(rows[row], 1),
        periodicidade: value(rows[row], 9),
      },
      matched,
    );
  }
  const cultureKey = configuredFieldKey(
    fields,
    "Habilidades Culturais",
    "habilidade_cultural",
    "Habilidades da Cultura Organizacional",
  );
  const roleKey = configuredFieldKey(
    fields,
    "Habilidades do Cargo",
    "habilidade_cargo",
    "Habilidades Específicas do Cargo",
  );
  const behaviorKey = configuredFieldKey(
    fields,
    "Postura & Comportamento",
    "postura_comportamento",
    "Postura e Comportamento",
  );
  for (let row = 65; row < rows.length; row += 1) {
    if (normalize(value(rows[row], 0)) === "data") break;
    putItem(
      draft,
      "habilidades_culturais",
      { [cultureKey]: selectedOption(rows[row], 0, 3) },
      matched,
    );
    putItem(draft, "habilidades_cargo", { [roleKey]: selectedOption(rows[row], 4, 7) }, matched);
    putItem(draft, "postura", { [behaviorKey]: selectedOption(rows[row], 8, 11) }, matched);
  }
}

function validateSpreadsheet(file: File) {
  if (!/\.(xlsx|xls)$/i.test(file.name))
    throw new Error("Envie uma planilha Excel (.xlsx ou .xls).");
}

async function readWorkbook(file: File) {
  validateSpreadsheet(file);
  return XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
}

export async function getDcSpreadsheetSheetNames(file: File) {
  const workbook = await readWorkbook(file);
  if (workbook.SheetNames.length === 0) throw new Error("A planilha não possui nenhuma aba.");
  return workbook.SheetNames;
}

function cellValue(row: unknown[], start: number) {
  for (let index = start; index < row.length; index += 1) {
    const value = row[index];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return "";
}

function fieldNames(field: DynamicField) {
  return new Set(
    [normalize(field.label), normalize(field.field_key), ...(FIELD_ALIASES[field.field_key] ?? [])]
      .map(normalize)
      .filter(Boolean),
  );
}

function findFieldForCell(
  raw: unknown,
  fieldByName: Map<string, DynamicField>,
  sectionFields: DynamicField[],
) {
  const label = normalize(raw);
  const exact = fieldByName.get(label);
  if (exact) return exact;
  if (label.length < 5) return undefined;
  // Aceita rótulos ligeiramente mais explicativos, sem comparar palavras curtas.
  const candidates = sectionFields.filter((field) =>
    [...fieldNames(field)].some(
      (name) => name.length >= 5 && (label.includes(name) || name.includes(label)),
    ),
  );
  return candidates.length === 1 ? candidates[0] : undefined;
}

function valueForLabel(
  rows: unknown[][],
  rowIndex: number,
  columnIndex: number,
  knownLabels: Set<string>,
) {
  const row = rows[rowIndex] ?? [];
  // Células mescladas criam lacunas. Procura a primeira resposta à direita,
  // ignorando outras perguntas que estejam no mesmo cabeçalho.
  for (let index = columnIndex + 1; index < row.length; index += 1) {
    const sameRow = String(row[index] ?? "").trim();
    if (sameRow && !knownLabels.has(normalize(sameRow))) return sameRow;
  }
  // Modelos de DC frequentemente colocam a resposta na linha logo abaixo da pergunta.
  for (let offset = 1; offset <= 2; offset += 1) {
    const next = cellValue(rows[rowIndex + offset] ?? [], columnIndex);
    if (next) return next;
  }
  return "";
}

function valueForConfiguredField(
  rows: unknown[][],
  rowIndex: number,
  columnIndex: number,
  field: DynamicField,
  knownLabels: Set<string>,
) {
  if (
    field.field_type !== "single_select" &&
    field.field_type !== "competency_description" &&
    field.field_type !== "multi_select"
  )
    return valueForLabel(rows, rowIndex, columnIndex, knownLabels);

  const options = new Map<string, string>();
  field.options.forEach((option) => {
    options.set(normalize(option.label), option.value);
    options.set(normalize(option.value), option.value);
  });
  const found: Array<{ value: string; checked: boolean | null }> = [];
  for (let row = rowIndex; row <= Math.min(rowIndex + 2, rows.length - 1); row += 1) {
    const cells = rows[row] ?? [];
    for (let column = columnIndex; column < cells.length; column += 1) {
      const raw = cells[column];
      const optionValue = options.get(normalize(raw));
      if (!optionValue) continue;
      const ownState = checkboxState(raw);
      const previousState = checkboxState(cells[column - 1]);
      const nextState = checkboxState(cells[column + 1]);
      found.push({ value: optionValue, checked: ownState ?? previousState ?? nextState });
    }
  }
  const checked = found.filter((item) => item.checked === true);
  if (field.field_type === "multi_select" && checked.length)
    return checked.map((item) => item.value).join(";");
  if (checked.length === 1) return checked[0].value;
  if (found.length === 1 && found[0].checked !== false) return found[0].value;
  return valueForLabel(rows, rowIndex, columnIndex, knownLabels);
}

function importedFieldValue(field: DynamicField, raw: DynamicItem[string]) {
  if (raw === undefined || raw === "") return raw;
  if (field.field_type === "checkbox") return checkboxState(raw) ?? Boolean(raw);
  if (field.field_type !== "single_select" && field.field_type !== "competency_description")
    return raw;

  const imported = normalize(Array.isArray(raw) ? raw[0] : raw);
  const exact = field.options.find(
    (option) => normalize(option.value) === imported || normalize(option.label) === imported,
  );
  if (exact) return exact.value;

  const compatible = field.options.filter((option) => {
    const label = normalize(option.label);
    const optionValue = normalize(option.value);
    return (
      (label.length >= 3 && (imported.includes(label) || label.includes(imported))) ||
      (optionValue.length >= 3 &&
        (imported.includes(optionValue) || optionValue.includes(imported)))
    );
  });
  return compatible.length === 1 ? compatible[0].value : raw;
}

function normalizeDraftFieldValues(draft: DescricaoCargo, fields: DynamicField[]) {
  const byKey = new Map(fields.map((field) => [field.field_key, field]));
  const draftValues = draft as unknown as Record<string, DynamicItem[string]>;
  for (const [key, raw] of Object.entries(draft.dynamic_values)) {
    const field = byKey.get(key);
    if (field) draft.dynamic_values[key] = importedFieldValue(field, raw);
  }
  for (const key of scalarKeys) {
    const field = byKey.get(key);
    if (field) draftValues[key] = importedFieldValue(field, draftValues[key]);
  }
  for (const section of DC_SECTIONS.filter((item) => item.repeater && item.arrayKey)) {
    const items = draft[section.arrayKey as keyof DescricaoCargo] as DynamicItem[];
    items.forEach((item) =>
      Object.entries(item).forEach(([key, raw]) => {
        const field = byKey.get(key);
        if (field) item[key] = importedFieldValue(field, raw);
      }),
    );
  }
}

export async function parseDcSpreadsheet(
  file: File,
  fields: DynamicField[],
  sheetName: string,
): Promise<Parsed> {
  const workbook = await readWorkbook(file);
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) throw new Error(`A aba "${sheetName}" não foi encontrada na planilha.`);
  const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    defval: "",
    raw: false,
  });
  const draft = emptyDC();
  const matched = new Set<string>();
  const knownLabels = new Set([
    ...Object.keys(LEGACY_HEADER_FIELDS),
    ...fields.flatMap((field) => [...fieldNames(field)]),
  ]);

  // O arquivo DC legado usa rótulos como "Nomenclatura do Cargo:". Fazemos
  // este primeiro passe para preservar o cabeçalho mesmo quando o projeto usa
  // nomes de campos personalizados na Base.
  rows.forEach((row, rowIndex) =>
    row.forEach((cell, columnIndex) => {
      const target = LEGACY_HEADER_FIELDS[normalize(cell)];
      if (!target) return;
      const imported = valueForLabel(rows, rowIndex, columnIndex, knownLabels);
      if (!imported) return;
      (draft as Record<string, unknown>)[target] = imported;
      matched.add(String(target));
    }),
  );
  parseLegacyDcTemplate(rows, draft, matched, fields);

  for (const section of DC_SECTIONS) {
    if (section.key === "Indicadores") continue;
    const sectionFields = fields.filter(
      (field) => normalize(field.section) === normalize(section.key),
    );
    if (!sectionFields.length) continue;
    const fieldByName = new Map<string, DynamicField>();
    sectionFields.forEach((field) =>
      fieldNames(field).forEach((name) => fieldByName.set(name, field)),
    );
    const hits: Array<{ row: number; column: number; field: DynamicField; value: string }> = [];

    rows.forEach((row, rowIndex) =>
      row.forEach((cell, columnIndex) => {
        const field = findFieldForCell(cell, fieldByName, sectionFields);
        if (field) {
          hits.push({
            row: rowIndex,
            column: columnIndex,
            field,
            value: valueForConfiguredField(rows, rowIndex, columnIndex, field, knownLabels),
          });
        }
      }),
    );

    if (!section.repeater) {
      hits.forEach((hit) => {
        if (!hit.value) return;
        matched.add(hit.field.field_key);
        if (scalarKeys.has(hit.field.field_key)) {
          (draft as Record<string, unknown>)[hit.field.field_key] = hit.value;
        } else {
          draft.dynamic_values[hit.field.field_key] = hit.value;
        }
      });
      continue;
    }

    const arrayKey = section.arrayKey as keyof DescricaoCargo;
    // Quando a planilha segue o modelo DC corporativo, os blocos já foram
    // extraídos por coordenadas e devem ser preservados integralmente.
    if ((draft[arrayKey] as DynamicItem[]).length > 0) continue;
    const tabularItems: DynamicItem[] = [];
    const hitsByRow = new Map<number, typeof hits>();
    hits.forEach((hit) => hitsByRow.set(hit.row, [...(hitsByRow.get(hit.row) ?? []), hit]));
    hitsByRow.forEach((headerHits, headerRow) => {
      if (headerHits.length < 2) return;
      for (let rowIndex = headerRow + 1; rowIndex < rows.length; rowIndex += 1) {
        const item: DynamicItem = {};
        headerHits.forEach((header) => {
          const value = String(rows[rowIndex]?.[header.column] ?? "").trim();
          if (value) item[header.field.field_key] = value;
        });
        if (Object.keys(item).length === 0) break;
        // Uma nova seção ou linha de perguntas encerra esta tabela.
        if (Object.values(item).some((value) => fieldByName.has(normalize(value)))) break;
        tabularItems.push(item);
      }
    });
    const items: DynamicItem[] = [];
    // Cada nova ocorrência do primeiro campo encontrado inicia um item. Isso cobre
    // tanto blocos verticais quanto tabelas com várias linhas de respostas.
    let current: DynamicItem | null = null;
    const firstFieldKey = sectionFields[0]?.field_key;
    hits
      .sort((a, b) => a.row - b.row || a.column - b.column)
      .forEach((hit) => {
        if (!hit.value) return;
        if (
          !current ||
          (hit.field.field_key === firstFieldKey && current[hit.field.field_key] !== undefined)
        ) {
          current = {};
          items.push(current);
        }
        current[hit.field.field_key] =
          hit.field.field_type === "multi_select"
            ? hit.value
                .split(/[;,|]/)
                .map((value) => value.trim())
                .filter(Boolean)
            : hit.value;
        matched.add(hit.field.field_key);
      });
    const parsedItems = tabularItems.length > 0 ? tabularItems : items;
    parsedItems.forEach((item) => Object.keys(item).forEach((key) => matched.add(key)));
    if (parsedItems.length) (draft as Record<string, unknown>)[arrayKey] = parsedItems;
  }

  normalizeDraftFieldValues(draft, fields);
  if (!draft.cargo)
    throw new Error(
      'Não foi possível identificar o campo "Cargo" na aba DC. Confira os títulos das perguntas.',
    );
  return { draft, sheetName, mappedFields: matched.size };
}
