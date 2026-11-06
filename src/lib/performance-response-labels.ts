export type PerformanceParticipantType = "collaborator" | "leader";

/**
 * Keeps answer options in first person for the collaborator and presents the
 * equivalent third-person wording to the leader, who evaluates the employee.
 */
export function responseOptionForParticipant(
  option: string,
  participantType?: PerformanceParticipantType,
) {
  if (participantType !== "leader") return option;

  const normalized = option
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  const employee = "O(a) colaborador(a)";

  if (normalized.startsWith("me destaco ao usar esta habilidade")) {
    return option.replace(/^Me destaco/i, `${employee} se destaca`);
  }
  if (normalized.startsWith("utilizo na pratica esta habilidade")) {
    return option.replace(/^Utilizo/i, `${employee} utiliza`);
  }
  if (normalized.startsWith("preciso melhorar")) {
    return option.replace(/^Preciso melhorar/i, `${employee} precisa melhorar`);
  }
  if (normalized.startsWith("demonstro este comportamento")) {
    return option.replace(/^Demonstro/i, `${employee} demonstra`);
  }
  if (normalized.startsWith("supero os resultados")) {
    return option.replace(/^Supero/i, `${employee} supera`);
  }
  if (normalized.startsWith("atinjo os resultados")) {
    return option.replace(/^Atinjo/i, `${employee} atinge`);
  }
  if (normalized.startsWith("na maioria das vezes, atinjo")) {
    return option.replace(
      /^Na maioria das vezes, atinjo/i,
      `Na maioria das vezes, ${employee} atinge`,
    );
  }
  if (normalized.startsWith("na maioria das vezes, não atinjo")) {
    return option.replace(
      /^Na maioria das vezes, n[aã]o atinjo/i,
      `Na maioria das vezes, ${employee} não atinge`,
    );
  }
  if (normalized.startsWith("não atinjo") || normalized.startsWith("não atinjo")) {
    return option.replace(/^N[aã]o atinjo/i, `${employee} não atinge`);
  }

  return option;
}

export function leaderOptionsFor(options?: string[]) {
  if (!options?.length) return undefined;
  const leaderOptions = options.map((option) => responseOptionForParticipant(option, "leader"));
  return leaderOptions.some((option, index) => option !== options[index])
    ? leaderOptions
    : undefined;
}

function normalizeResponseOption(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Resolves a participant-specific label to the canonical collaborator option. */
export function canonicalResponseValue(
  value: string,
  options?: string[],
  leaderOptions?: string[],
) {
  if (!value || !options?.length) return value;
  const normalizedValue = normalizeResponseOption(value);
  const canonicalIndex = options.findIndex(
    (option) => normalizeResponseOption(option) === normalizedValue,
  );
  if (canonicalIndex >= 0) return options[canonicalIndex];

  const resolvedLeaderOptions =
    leaderOptions?.length === options.length
      ? leaderOptions
      : options.map((option) => responseOptionForParticipant(option, "leader"));
  const leaderIndex = resolvedLeaderOptions.findIndex(
    (option) => normalizeResponseOption(option) === normalizedValue,
  );
  return leaderIndex >= 0 ? options[leaderIndex] : value;
}

export function canonicalizePerformanceAnswers(
  answers: Record<string, unknown>,
  questions: Array<{ id?: unknown; options?: unknown; leaderOptions?: unknown }>,
) {
  const result = { ...answers };
  for (const question of questions) {
    if (typeof question.id !== "string" || typeof result[question.id] !== "string") continue;
    const options = Array.isArray(question.options)
      ? question.options.filter((option): option is string => typeof option === "string")
      : undefined;
    const leaderOptions = Array.isArray(question.leaderOptions)
      ? question.leaderOptions.filter((option): option is string => typeof option === "string")
      : undefined;
    result[question.id] = canonicalResponseValue(
      result[question.id] as string,
      options,
      leaderOptions,
    );
  }
  return result;
}

export function responseValueForParticipant(
  value: string,
  options: string[] | undefined,
  participantType?: PerformanceParticipantType,
  participantOptions?: string[],
) {
  if (!value || !options?.length) return value;

  const canonicalValue = canonicalResponseValue(value, options, participantOptions);
  const resolvedOptions =
    participantType === "leader"
      ? (participantOptions ??
        options.map((option) => responseOptionForParticipant(option, participantType)))
      : options;
  if (participantType !== "leader") return canonicalValue;

  const originalIndex = options.findIndex(
    (option) => normalizeResponseOption(option) === normalizeResponseOption(canonicalValue),
  );
  if (originalIndex < 0) return canonicalValue;

  return resolvedOptions[originalIndex] ?? canonicalValue;
}
