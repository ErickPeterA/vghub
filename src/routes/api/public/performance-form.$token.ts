import { createFileRoute } from "@tanstack/react-router";

type PerformanceQuestion = {
  id: string;
  label: string;
  leaderLabel?: string;
  type: "text" | "textarea" | "select";
  required: boolean;
  active?: boolean;
  options?: string[];
  leaderOptions?: string[];
  helpText?: string;
  source?: "activity" | "config" | "job_description";
  sectionTitle?: string;
  groupId?: string;
  groupTitle?: string;
  groupDescription?: string;
  dynamicSource?: "activities" | "indicators" | "culture_skills" | "role_skills" | "behavior";
  dynamicRole?: "efficiency" | "efficacy" | "result" | "reach" | "fit" | "rating";
};

type JsonRecord = Record<string, unknown>;
type BaseFieldRow = {
  field_key: string;
  label: string;
  section: string;
  base_options?: Array<{
    label: string;
    value: string;
    description?: string | null;
    is_active?: boolean | null;
  }>;
};

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function snapshotValue(snapshot: JsonRecord, key: string) {
  return stringValue(snapshot[key]) ?? stringValue(asRecord(snapshot.dynamic_values)[key]);
}

function normalizeLookup(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function isInternalOptionValue(value: string) {
  const normalized = normalizeLookup(value);
  return (
    /^(sim|nao|nÃ£o)_\d+$/.test(normalized) ||
    /^[a-z0-9_-]+_\d{8,}$/.test(normalized) ||
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(normalized)
  );
}

function stringFromUnknown(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
}

function isNonTitleValue(value: string) {
  const normalized = normalizeLookup(value);
  return (
    !normalized ||
    /^atividade\s+\d+$/.test(normalized) ||
    /^item\s+\d+$/.test(normalized) ||
    ["sim", "nao", "nÃ£o"].includes(normalized) ||
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
      "sempre que necessÃ¡rio",
    ].includes(normalized) ||
    isInternalOptionValue(value)
  );
}

function arrayFromSnapshot(snapshot: JsonRecord, key: string) {
  const value = snapshot[key] ?? asRecord(snapshot.dynamic_values)[key];
  return Array.isArray(value) ? (value as JsonRecord[]) : [];
}

function fieldsForDynamicSource(
  fields: BaseFieldRow[],
  source?: PerformanceQuestion["dynamicSource"],
) {
  const sectionNames: Record<string, string[]> = {
    activities: ["atividades"],
    indicators: ["indicadores"],
    culture_skills: ["habilidades culturais"],
    role_skills: ["habilidades do cargo"],
    behavior: ["postura", "comportamento"],
  };
  const expected = source ? (sectionNames[source] ?? []) : [];
  return fields.filter((field) =>
    expected.some((name) => normalizeLookup(field.section).includes(name)),
  );
}

function optionLabelForValue(field: BaseFieldRow, value: string) {
  return (
    field.base_options?.find((option) => option.value === value && option.is_active !== false)
      ?.label ?? value
  );
}

function optionDescriptionForValue(field: BaseFieldRow, value: string) {
  return (
    field.base_options?.find((option) => option.value === value && option.is_active !== false)
      ?.description ?? ""
  ).trim();
}

function pickItemValueFromFields(
  item: JsonRecord,
  fields: BaseFieldRow[],
  includes: string[],
  excludes: string[] = [],
) {
  const includeTerms = includes.map(normalizeLookup);
  const excludeTerms = excludes.map(normalizeLookup);
  const field = fields.find((candidate) => {
    const searchable = `${normalizeLookup(candidate.label)} ${normalizeLookup(candidate.field_key)}`;
    return (
      includeTerms.some((term) => searchable.includes(term)) &&
      !excludeTerms.some((term) => searchable.includes(term))
    );
  });
  if (!field) return "";
  const value = stringFromUnknown(item[field.field_key]);
  const label = value ? optionLabelForValue(field, value) : "";
  if (!label || isInternalOptionValue(label)) return "";
  return label;
}

function pickItemValueFromExactField(item: JsonRecord, fields: BaseFieldRow[], names: string[]) {
  const expected = names.map(normalizeLookup);
  const field = fields.find((candidate) => {
    const label = normalizeLookup(candidate.label);
    const key = normalizeLookup(candidate.field_key);
    return expected.includes(label) || expected.includes(key);
  });
  if (!field) return "";
  const value = stringFromUnknown(item[field.field_key]);
  const label = value ? optionLabelForValue(field, value) : "";
  if (!label || isInternalOptionValue(label)) return "";
  return label;
}

function pickItemValueFromExactLabel(item: JsonRecord, fields: BaseFieldRow[], labels: string[]) {
  const expected = labels.map(normalizeLookup);
  const field = fields.find((candidate) => expected.includes(normalizeLookup(candidate.label)));
  if (!field) return "";
  const value = stringFromUnknown(item[field.field_key]);
  const label = value ? optionLabelForValue(field, value) : "";
  if (!label || isNonTitleValue(label)) return "";
  return label;
}

function pickItemValueFromExactKey(item: JsonRecord, names: string[]) {
  const expected = names.map(normalizeLookup);
  const entry = Object.entries(item).find(([key]) => expected.includes(normalizeLookup(key)));
  const value = entry ? stringFromUnknown(entry[1]) : "";
  return value && !isNonTitleValue(value) ? value : "";
}

function pickLongestText(item: JsonRecord, preferredKeys: string[]) {
  const entries = Object.entries(item);
  for (const key of preferredKeys) {
    const normalizedKey = normalizeLookup(key);
    const match = entries.find(([entryKey]) => normalizeLookup(entryKey).includes(normalizedKey));
    const value = match ? stringFromUnknown(match[1]) : "";
    if (value && !isNonTitleValue(value)) return value;
  }
  return (
    entries
      .map(([, value]) => stringFromUnknown(value))
      .filter(
        (value) =>
          value &&
          !["sim", "nao", "nÃ£o"].includes(normalizeLookup(value)) &&
          !isInternalOptionValue(value),
      )
      .sort((a, b) => b.length - a.length)[0] ?? ""
  );
}

function itemsForQuestion(snapshot: JsonRecord, question: PerformanceQuestion) {
  if (question.dynamicSource === "activities") return arrayFromSnapshot(snapshot, "atividades");
  if (question.dynamicSource === "indicators") return arrayFromSnapshot(snapshot, "indicadores");
  if (question.dynamicSource === "culture_skills")
    return arrayFromSnapshot(snapshot, "habilidades_culturais");
  if (question.dynamicSource === "role_skills")
    return arrayFromSnapshot(snapshot, "habilidades_cargo");
  if (question.dynamicSource === "behavior") return arrayFromSnapshot(snapshot, "postura");
  return [];
}

function titleForQuestion(
  snapshot: JsonRecord,
  fields: BaseFieldRow[],
  question: PerformanceQuestion,
) {
  if (!question.dynamicSource || !question.groupId) return question.groupTitle;
  const index = Number(question.groupId.match(/_(\d+)$/)?.[1] ?? "0") - 1;
  const item = itemsForQuestion(snapshot, question)[index];
  if (!item) return question.groupTitle;
  const sourceFields = fieldsForDynamicSource(fields, question.dynamicSource);
  if (question.dynamicSource === "activities") {
    return (
      pickItemValueFromExactLabel(item, fields, ["Atividade"]) ||
      pickItemValueFromExactKey(item, ["atividade"]) ||
      pickItemValueFromExactField(item, sourceFields, ["atividade"]) ||
      pickItemValueFromFields(item, sourceFields, ["atividade"], ["principal"]) ||
      pickLongestText(item, ["atividade", "descricao", "descriÃ§Ã£o", "texto", "nome"]) ||
      (question.groupTitle && !isNonTitleValue(question.groupTitle) ? question.groupTitle : null)
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
      pickLongestText(item, ["indicador", "nomenclatura", "nome"]);
    const goal =
      pickItemValueFromExactLabel(item, sourceFields, ["Meta", "Resultado esperado"]) ||
      pickItemValueFromExactKey(item, ["meta", "resultado_esperado"]) ||
      pickItemValueFromFields(item, sourceFields, ["meta", "resultado esperado"]) ||
      pickLongestText(item, ["meta", "resultado esperado"]);
    return (
      [indicator, goal ? `Meta: ${goal}` : ""].filter(Boolean).join(" | ") ||
      (question.groupTitle && !isNonTitleValue(question.groupTitle) ? question.groupTitle : null)
    );
  }
  const titleLabels: Record<string, string[]> = {
    culture_skills: ["Habilidade cultural", "Habilidade", "CompetÃªncia", "Competencia"],
    role_skills: [
      "Habilidade do cargo",
      "Habilidade especÃ­fica do cargo",
      "Habilidade especifica do cargo",
      "Habilidade",
      "CompetÃªncia",
      "Competencia",
    ],
    behavior: ["Postura e comportamento", "Postura", "Comportamento"],
  };
  const titleKeys: Record<string, string[]> = {
    culture_skills: ["habilidade_cultural", "habilidade", "competencia"],
    role_skills: ["habilidade_cargo", "habilidade_do_cargo", "habilidade", "competencia"],
    behavior: ["postura_comportamento", "postura", "comportamento"],
  };
  return (
    pickItemValueFromExactLabel(item, sourceFields, titleLabels[question.dynamicSource] ?? []) ||
    pickItemValueFromExactKey(item, titleKeys[question.dynamicSource] ?? []) ||
    pickItemValueFromFields(item, sourceFields, [
      "habilidade",
      "postura",
      "comportamento",
      "competencia",
      "competÃªncia",
      "nome",
      "descricao",
      "descriÃ§Ã£o",
    ]) ||
    pickLongestText(item, [
      "habilidade",
      "postura",
      "comportamento",
      "competencia",
      "competÃªncia",
      "nome",
      "descricao",
      "descriÃ§Ã£o",
    ]) ||
    (question.groupTitle && !isNonTitleValue(question.groupTitle) ? question.groupTitle : null)
  );
}

function descriptionForQuestion(
  snapshot: JsonRecord,
  fields: BaseFieldRow[],
  question: PerformanceQuestion,
) {
  if (
    question.dynamicSource !== "culture_skills" &&
    question.dynamicSource !== "role_skills"
  ) {
    return question.groupDescription;
  }
  if (!question.groupId) return question.groupDescription;
  const index = Number(question.groupId.match(/_(\d+)$/)?.[1] ?? "0") - 1;
  const item = itemsForQuestion(snapshot, question)[index];
  if (!item) return question.groupDescription;
  const sourceFields = fieldsForDynamicSource(fields, question.dynamicSource);
  const expectedLabels =
    question.dynamicSource === "culture_skills"
      ? ["Habilidade cultural", "Habilidade", "CompetÃƒÂªncia", "Competencia"]
      : [
          "Habilidade do cargo",
          "Habilidade especÃƒÂ­fica do cargo",
          "Habilidade especifica do cargo",
          "Habilidade",
          "CompetÃƒÂªncia",
          "Competencia",
        ];
  const expectedKeys =
    question.dynamicSource === "culture_skills"
      ? ["habilidade_cultural", "habilidade", "competencia"]
      : ["habilidade_cargo", "habilidade_do_cargo", "habilidade", "competencia"];
  const expected = [...expectedLabels, ...expectedKeys].map(normalizeLookup);
  const field =
    sourceFields.find((candidate) => {
      const label = normalizeLookup(candidate.label);
      const key = normalizeLookup(candidate.field_key);
      return expected.includes(label) || expected.includes(key);
    }) ??
    sourceFields.find((candidate) => {
      const searchable = `${normalizeLookup(candidate.label)} ${normalizeLookup(candidate.field_key)}`;
      return searchable.includes("habilidade") || searchable.includes("competencia");
    });
  if (!field) return question.groupDescription;
  const value = stringFromUnknown(item[field.field_key]);
  if (!value) return question.groupDescription;
  return optionDescriptionForValue(field, value) || question.groupDescription;
}

export const Route = createFileRoute("/api/public/performance-form/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const token = params.token;
        if (!token || token.length < 20) {
          return Response.json(
            { error: "invalid_token", message: "Link invalido." },
            { status: 400 },
          );
        }

        try {
          const { query } = await import("@/server/db/pool");
          const participantResult = await query(
            `
              select id, review_id, participant_type, status, expires_at, sent_at,
                     draft_answers, draft_saved_at
                from public.performance_review_participants
               where token::text = $1
               limit 1
            `,
            [token],
          );
          const participant = participantResult.rows[0];

          if (!participant) {
            return Response.json(
              { error: "not_found", message: "Este link nao existe ou foi removido." },
              { status: 404 },
            );
          }
          if (participant.status === "answered") {
            return Response.json(
              { error: "already_answered", message: "Este formulario ja foi respondido. Obrigado!" },
              { status: 410 },
            );
          }
          if (new Date(participant.expires_at) < new Date()) {
            return Response.json(
              { error: "expired", message: "Este link expirou. Solicite um novo ao responsavel." },
              { status: 410 },
            );
          }

          const reviewResult = await query(
            `
              select id, project_id, name, status, review_type, employee_id,
                     employee_position_id, leader_position_id, employee_name, leader_name,
                     job_title, job_description_snapshot, questions_snapshot, created_at
                from public.performance_reviews
               where id = $1::uuid
               limit 1
            `,
            [participant.review_id],
          );
          const review = reviewResult.rows[0];

          if (!review) {
            return Response.json(
              { error: "not_found", message: "Avaliacao nao encontrada." },
              { status: 404 },
            );
          }
          if (review.status === "finalized") {
            return Response.json(
              { error: "finalized", message: "Esta avaliacao ja foi finalizada." },
              { status: 410 },
            );
          }

          if (participant.status === "not_sent" || participant.status === "sent") {
            await query(
              `
                update public.performance_review_participants
                   set status = 'accessed', accessed_at = now()
                 where id = $1::uuid
              `,
              [participant.id],
            );
          }

          const snapshot = asRecord(review.job_description_snapshot);
          const baseFields = await query(
            `
              select bf.field_key,
                     bf.label,
                     bf.section,
                     coalesce(
                       jsonb_agg(
                         jsonb_build_object(
                           'label', bo.label,
                           'value', bo.value,
                           'description', bo.description,
                           'is_active', bo.is_active
                         ) order by bo.display_order, bo.created_at
                       ) filter (where bo.id is not null),
                       '[]'::jsonb
                     ) as base_options
                from public.base_fields bf
                left join public.base_options bo on bo.field_id = bf.id
               where bf.project_id = $1::uuid
                 and bf.is_active = true
               group by bf.id
            `,
            [review.project_id],
          );
          const questions = [...((review.questions_snapshot as PerformanceQuestion[] | null) ?? [])]
            .filter((question) => question.active ?? true)
            .map((question) => ({
              ...question,
              groupTitle: titleForQuestion(
                snapshot,
                (baseFields.rows ?? []) as unknown as BaseFieldRow[],
                question,
              ),
              groupDescription: descriptionForQuestion(
                snapshot,
                (baseFields.rows ?? []) as unknown as BaseFieldRow[],
                question,
              ),
            }));

          const [employee, employeePosition, leaderPosition] = await Promise.all([
            review.employee_id
              ? query(`select admission_date, area_id, sector_id from public.project_employees where id = $1::uuid limit 1`, [review.employee_id])
              : Promise.resolve({ rows: [] }),
            review.employee_position_id
              ? query(`select nome from public.project_positions where id = $1::uuid limit 1`, [review.employee_position_id])
              : Promise.resolve({ rows: [] }),
            review.leader_position_id
              ? query(`select nome from public.project_positions where id = $1::uuid limit 1`, [review.leader_position_id])
              : Promise.resolve({ rows: [] }),
          ]);
          const employeeRow = employee.rows[0] as {
            admission_date?: string;
            area_id?: string | null;
            sector_id?: string | null;
          } | null;
          const [area, sector] = await Promise.all([
            employeeRow?.area_id
              ? query(`select nome from public.project_areas where id = $1::uuid limit 1`, [employeeRow.area_id])
              : Promise.resolve({ rows: [] }),
            employeeRow?.sector_id
              ? query(`select nome from public.project_areas where id = $1::uuid limit 1`, [employeeRow.sector_id])
              : Promise.resolve({ rows: [] }),
          ]);

          const areaName =
            stringValue((area.rows[0] as { nome?: string } | null)?.nome) ??
            snapshotValue(snapshot, "area") ??
            snapshotValue(snapshot, "unidade_negocio");
          const sectorName =
            stringValue((sector.rows[0] as { nome?: string } | null)?.nome) ??
            snapshotValue(snapshot, "setor") ??
            snapshotValue(snapshot, "departamento");
          const areaSector = [areaName, sectorName].filter(Boolean).join(" / ");

          return Response.json({
            ok: true,
            reviewName: review.name,
            reviewType: review.review_type ?? "performance",
            participantType: participant.participant_type,
            employeeName: review.employee_name,
            leaderName: review.leader_name,
            jobTitle: review.job_title,
            header: {
              sentAt: participant.sent_at ?? null,
              expiresAt: participant.expires_at,
              positionName:
                stringValue((employeePosition.rows[0] as { nome?: string } | null)?.nome) ?? review.job_title,
              careerType: snapshotValue(snapshot, "tipo_carreira"),
              areaSector: areaSector || null,
              leaderPositionName:
                stringValue((leaderPosition.rows[0] as { nome?: string } | null)?.nome) ??
                snapshotValue(snapshot, "superior_imediato"),
              employeeName: review.employee_name,
              leaderName: review.leader_name,
              admissionDate: employeeRow?.admission_date ?? null,
            },
            draftAnswers: participant.draft_answers ?? {},
            draftSavedAt: participant.draft_saved_at,
            questions,
          });
        } catch (error) {
          console.error(error);
          return Response.json(
            { error: "server_error", message: "Erro ao buscar formulario." },
            { status: 500 },
          );
        }
      },
    },
  },
});
