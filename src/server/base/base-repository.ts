import { query, withTransaction } from "@/server/db/pool";
import type { PoolClient } from "pg";
import { HttpError } from "@/server/http/errors";

export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "checkbox"
  | "single_select"
  | "multi_select"
  | "competency_description";

export type DataSource = "manual" | "areas" | "setores";

export type BaseOption = {
  id: string;
  field_id: string;
  label: string;
  value: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type BaseField = {
  id: string;
  project_id: string | null;
  source_field_id: string | null;
  field_key: string;
  label: string;
  section: string;
  field_type: FieldType;
  is_required: boolean;
  display_order: number;
  allows_multiple: boolean;
  allows_free_text: boolean;
  data_source: DataSource;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  base_options: BaseOption[];
};

export type BaseSectionSetting = {
  id: string;
  project_id: string | null;
  section: string;
  max_items: number;
  is_enabled: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type FieldRow = Omit<BaseField, "created_at" | "updated_at" | "base_options"> & {
  created_at: Date | string;
  updated_at: Date | string;
  base_options: Array<Omit<BaseOption, "created_at" | "updated_at"> & {
    created_at: Date | string;
    updated_at: Date | string;
  }>;
};

type SettingRow = Omit<BaseSectionSetting, "created_at" | "updated_at"> & {
  created_at: Date | string;
  updated_at: Date | string;
};

export type FieldPatch = Partial<{
  field_key: string;
  label: string;
  section: string;
  field_type: FieldType;
  is_required: boolean;
  display_order: number;
  allows_multiple: boolean;
  allows_free_text: boolean;
  is_active: boolean;
  data_source: DataSource;
}>;

export type OptionPatch = Partial<{
  label: string;
  value: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
}>;

function iso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : value;
}

function mapOption(option: FieldRow["base_options"][number]): BaseOption {
  return {
    ...option,
    created_at: iso(option.created_at),
    updated_at: iso(option.updated_at),
  };
}

function mapField(row: FieldRow): BaseField {
  return {
    ...row,
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
    base_options: (row.base_options ?? []).map(mapOption),
  };
}

function mapSetting(row: SettingRow): BaseSectionSetting {
  return {
    ...row,
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
  };
}

export async function canManageBaseScope(userId: string, projectId: string | null) {
  const result = await query<{ allowed: boolean }>(
    projectId
      ? `
          select (
            public.is_admin($1::uuid)
            or exists (
              select 1
              from public.project_members pm
              where pm.project_id = $2::uuid
                and pm.user_id = $1::uuid
                and pm.role in ('gp'::public.project_role, 'admin'::public.project_role)
            )
          ) as allowed
        `
      : `
          select (public.is_admin($1::uuid) or public.is_any_gp($1::uuid)) as allowed
        `,
    projectId ? [userId, projectId] : [userId],
  );

  return result.rows[0]?.allowed === true;
}

export async function requireCanManageBaseScope(userId: string, projectId: string | null) {
  if (!(await canManageBaseScope(userId, projectId))) {
    throw new HttpError(403, "forbidden", "Sem permissao para gerenciar esta base.");
  }
}

export async function listBaseConfig(userId: string, projectId: string | null) {
  await requireCanManageBaseScope(userId, projectId);

  const [fieldsResult, settingsResult] = await Promise.all([
    query<FieldRow>(
      `
        select
          f.id,
          f.project_id,
          f.source_field_id,
          f.field_key,
          f.label,
          f.section,
          f.field_type::text as field_type,
          f.is_required,
          f.display_order,
          f.allows_multiple,
          f.allows_free_text,
          f.data_source,
          f.is_active,
          f.created_by,
          f.created_at,
          f.updated_at,
          coalesce(
            jsonb_agg(
              jsonb_build_object(
                'id', o.id,
                'field_id', o.field_id,
                'label', o.label,
                'value', o.value,
                'description', o.description,
                'display_order', o.display_order,
                'is_active', o.is_active,
                'created_at', o.created_at,
                'updated_at', o.updated_at
              )
              order by o.display_order, o.created_at
            ) filter (where o.id is not null),
            '[]'::jsonb
          ) as base_options
        from public.base_fields f
        left join public.base_options o on o.field_id = f.id
        where f.project_id is not distinct from $1::uuid
        group by f.id
        order by f.display_order, f.created_at
      `,
      [projectId],
    ),
    query<SettingRow>(
      `
        select id, project_id, section, max_items, is_enabled, created_by, created_at, updated_at
        from public.base_section_settings
        where project_id is not distinct from $1::uuid
        order by section
      `,
      [projectId],
    ),
  ]);

  return {
    fields: fieldsResult.rows.map(mapField),
    sectionSettings: settingsResult.rows.map(mapSetting),
  };
}

async function getFieldScope(fieldId: string) {
  const result = await query<{ project_id: string | null }>(
    `select project_id from public.base_fields where id = $1::uuid`,
    [fieldId],
  );

  return result.rows[0]?.project_id;
}

async function getOptionScope(optionId: string) {
  const result = await query<{ project_id: string | null }>(
    `
      select f.project_id
      from public.base_options o
      join public.base_fields f on f.id = o.field_id
      where o.id = $1::uuid
    `,
    [optionId],
  );

  return result.rows[0]?.project_id;
}

async function getFieldById(fieldId: string, client?: PoolClient) {
  const executor = client ?? { query };
  const result = await executor.query<FieldRow>(
    `
      select
        f.id,
        f.project_id,
        f.source_field_id,
        f.field_key,
        f.label,
        f.section,
        f.field_type::text as field_type,
        f.is_required,
        f.display_order,
        f.allows_multiple,
        f.allows_free_text,
        f.data_source,
        f.is_active,
        f.created_by,
        f.created_at,
        f.updated_at,
        coalesce(
          jsonb_agg(
            jsonb_build_object(
              'id', o.id,
              'field_id', o.field_id,
              'label', o.label,
              'value', o.value,
              'description', o.description,
              'display_order', o.display_order,
              'is_active', o.is_active,
              'created_at', o.created_at,
              'updated_at', o.updated_at
            )
            order by o.display_order, o.created_at
          ) filter (where o.id is not null),
          '[]'::jsonb
        ) as base_options
      from public.base_fields f
      left join public.base_options o on o.field_id = f.id
      where f.id = $1::uuid
      group by f.id
    `,
    [fieldId],
  );

  return result.rows[0] ? mapField(result.rows[0]) : null;
}

export async function createBaseField(input: {
  actorUserId: string;
  projectId: string | null;
  field: {
    field_key: string;
    label: string;
    section: string;
    field_type?: FieldType;
    is_required?: boolean;
    display_order?: number;
    allows_multiple?: boolean;
    allows_free_text?: boolean;
    is_active?: boolean;
    data_source?: DataSource;
  };
  options?: Array<{
    label: string;
    value: string;
    description?: string | null;
    display_order?: number;
    is_active?: boolean;
  }>;
}) {
  await requireCanManageBaseScope(input.actorUserId, input.projectId);

  return withTransaction(async (client) => {
    const fieldResult = await client.query<{ id: string }>(
      `
        insert into public.base_fields (
          project_id,
          field_key,
          label,
          section,
          field_type,
          is_required,
          display_order,
          allows_multiple,
          allows_free_text,
          is_active,
          data_source,
          created_by
        )
        values (
          $1::uuid,
          $2,
          $3,
          $4,
          $5::public.dynamic_field_type,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          $12::uuid
        )
        returning id
      `,
      [
        input.projectId,
        input.field.field_key,
        input.field.label,
        input.field.section,
        input.field.field_type ?? "text",
        input.field.is_required ?? false,
        input.field.display_order ?? 0,
        input.field.allows_multiple ?? false,
        input.field.allows_free_text ?? false,
        input.field.is_active ?? true,
        input.field.data_source ?? "manual",
        input.actorUserId,
      ],
    );

    const fieldId = fieldResult.rows[0]?.id;
    if (!fieldId) throw new Error("Campo nao foi criado.");

    for (const [index, option] of (input.options ?? []).entries()) {
      await client.query(
        `
          insert into public.base_options
            (field_id, label, value, description, display_order, is_active)
          values ($1::uuid, $2, $3, $4, $5, $6)
        `,
        [
          fieldId,
          option.label,
          option.value,
          option.description ?? null,
          option.display_order ?? (index + 1) * 10,
          option.is_active ?? true,
        ],
      );
    }

    const created = await getFieldById(fieldId, client);
    if (!created) throw new Error("Campo criado nao foi encontrado.");
    return created;
  });
}

function entries(patch: Record<string, unknown>) {
  return Object.entries(patch).filter(([, value]) => value !== undefined);
}

export async function updateBaseField(actorUserId: string, fieldId: string, patch: FieldPatch) {
  const projectId = await getFieldScope(fieldId);
  if (projectId === undefined) return null;
  await requireCanManageBaseScope(actorUserId, projectId);

  const values = entries(patch as Record<string, unknown>);
  if (values.length === 0) return getFieldById(fieldId);

  const setSql = values
    .map(([key], index) =>
      key === "field_type"
        ? `${key} = $${index + 2}::public.dynamic_field_type`
        : `${key} = $${index + 2}`,
    )
    .join(", ");

  await query(
    `
      update public.base_fields
      set ${setSql}
      where id = $1::uuid
    `,
    [fieldId, ...values.map(([, value]) => value)],
  );

  return getFieldById(fieldId);
}

export async function deleteBaseField(actorUserId: string, fieldId: string) {
  const projectId = await getFieldScope(fieldId);
  if (projectId === undefined) return false;
  await requireCanManageBaseScope(actorUserId, projectId);

  const result = await query<{ id: string }>(
    `delete from public.base_fields where id = $1::uuid returning id`,
    [fieldId],
  );

  return result.rowCount > 0;
}

export async function updateBaseFieldOrder(
  actorUserId: string,
  updates: Array<{ id: string; section: string; display_order: number }>,
) {
  if (updates.length === 0) return;

  await withTransaction(async (client) => {
    const scopeResult = await client.query<{ project_id: string | null }>(
      `
        select distinct project_id
        from public.base_fields
        where id = any($1::uuid[])
      `,
      [updates.map((update) => update.id)],
    );

    if (scopeResult.rows.length !== 1 || scopeResult.rows[0]?.project_id === undefined) {
      throw new HttpError(400, "invalid_fields", "Campos invalidos para reordenacao.");
    }

    await requireCanManageBaseScope(actorUserId, scopeResult.rows[0].project_id);

    for (const update of updates) {
      await client.query(
        `
          update public.base_fields
          set section = $2, display_order = $3
          where id = $1::uuid
        `,
        [update.id, update.section, update.display_order],
      );
    }
  });
}

export async function upsertBaseSectionSetting(input: {
  actorUserId: string;
  projectId: string | null;
  section: string;
  max_items: number;
  is_enabled: boolean;
}) {
  await requireCanManageBaseScope(input.actorUserId, input.projectId);

  if (input.projectId) {
    const result = await query<SettingRow>(
      `
        insert into public.base_section_settings
          (project_id, section, max_items, is_enabled, created_by)
        values ($1::uuid, $2, $3, $4, $5::uuid)
        on conflict (project_id, section) where project_id is not null
        do update set max_items = excluded.max_items, is_enabled = excluded.is_enabled
        returning id, project_id, section, max_items, is_enabled, created_by, created_at, updated_at
      `,
      [
        input.projectId,
        input.section,
        input.max_items,
        input.is_enabled,
        input.actorUserId,
      ],
    );

    return mapSetting(result.rows[0]);
  }

  const generalResult = await query<SettingRow>(
    `
      insert into public.base_section_settings
        (project_id, section, max_items, is_enabled, created_by)
      values (null, $1, $2, $3, $4::uuid)
      on conflict (section) where project_id is null
      do update set max_items = excluded.max_items, is_enabled = excluded.is_enabled
      returning id, project_id, section, max_items, is_enabled, created_by, created_at, updated_at
    `,
    [input.section, input.max_items, input.is_enabled, input.actorUserId],
  );

  return mapSetting(generalResult.rows[0]);
}

export async function createBaseOption(input: {
  actorUserId: string;
  fieldId: string;
  label: string;
  value: string;
  description?: string | null;
  display_order?: number;
  is_active?: boolean;
}) {
  const projectId = await getFieldScope(input.fieldId);
  if (projectId === undefined) return null;
  await requireCanManageBaseScope(input.actorUserId, projectId);

  const result = await query<BaseOption & { created_at: Date | string; updated_at: Date | string }>(
    `
      insert into public.base_options
        (field_id, label, value, description, display_order, is_active)
      values ($1::uuid, $2, $3, $4, $5, $6)
      returning id, field_id, label, value, description, display_order, is_active, created_at, updated_at
    `,
    [
      input.fieldId,
      input.label,
      input.value,
      input.description ?? null,
      input.display_order ?? 0,
      input.is_active ?? true,
    ],
  );

  return mapOption(result.rows[0]);
}

export async function updateBaseOption(
  actorUserId: string,
  optionId: string,
  patch: OptionPatch,
) {
  const projectId = await getOptionScope(optionId);
  if (projectId === undefined) return null;
  await requireCanManageBaseScope(actorUserId, projectId);

  const values = entries(patch as Record<string, unknown>);
  if (values.length === 0) {
    const existing = await query<BaseOption & { created_at: Date | string; updated_at: Date | string }>(
      `
        select id, field_id, label, value, description, display_order, is_active, created_at, updated_at
        from public.base_options
        where id = $1::uuid
      `,
      [optionId],
    );
    return existing.rows[0] ? mapOption(existing.rows[0]) : null;
  }

  const result = await query<BaseOption & { created_at: Date | string; updated_at: Date | string }>(
    `
      update public.base_options
      set ${values.map(([key], index) => `${key} = $${index + 2}`).join(", ")}
      where id = $1::uuid
      returning id, field_id, label, value, description, display_order, is_active, created_at, updated_at
    `,
    [optionId, ...values.map(([, value]) => value)],
  );

  return result.rows[0] ? mapOption(result.rows[0]) : null;
}

export async function deleteBaseOption(actorUserId: string, optionId: string) {
  const projectId = await getOptionScope(optionId);
  if (projectId === undefined) return false;
  await requireCanManageBaseScope(actorUserId, projectId);

  const result = await query<{ id: string }>(
    `delete from public.base_options where id = $1::uuid returning id`,
    [optionId],
  );

  return result.rowCount > 0;
}
