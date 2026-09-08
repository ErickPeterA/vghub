import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-middleware";
import { query, withTransaction } from "@/server/db/pool";
import { assertAdminPostgres } from "@/server/admin/admin-repository";
import { hashPassword } from "@/server/auth/password";

const projectRoleSchema = z.enum([
  "admin",
  "lider_estrategico",
  "lider_tatico",
  "lider_operacional",
  "gp",
  "lider_superior",
  "lider_setor",
  "usuario_comum",
]);
export type ProjectRoleValue = z.infer<typeof projectRoleSchema>;

async function assertAdmin(userId: string) {
  await assertAdminPostgres(userId);
}

export const createUserAdmin = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input) =>
    z
      .object({
        nome: z.string().min(1).max(255),
        email: z.string().email(),
        password: z.string().min(10).max(255),
        isAdmin: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const passwordHash = await hashPassword(data.password);
    const newId = await withTransaction(async (client) => {
      const created = await client.query<{ id: string }>(
        `
          insert into public.users (email, display_name, password_hash, password_changed_at)
          values ($1, $2, $3, now())
          returning id
        `,
        [data.email.toLowerCase(), data.nome, passwordHash],
      );
      const createdId = created.rows[0].id;
      await client.query(
        `
          insert into public.profiles (id, nome, email)
          values ($1::uuid, $2, $3)
          on conflict (id) do update
          set nome = excluded.nome, email = excluded.email, updated_at = now()
        `,
        [createdId, data.nome, data.email.toLowerCase()],
      );
      if (data.isAdmin) {
        await client.query(
          `
            insert into public.user_roles (user_id, role)
            values ($1::uuid, 'admin'::public.app_role)
            on conflict (user_id, role) do nothing
          `,
          [createdId],
        );
      }
      return createdId;
    });
    return { id: newId };
  });

export const updateUserAdmin = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input) =>
    z
      .object({
        userId: z.string().uuid(),
        nome: z.string().min(1).max(255).optional(),
        email: z.string().email().optional(),
        password: z.string().min(10).max(255).optional(),
        status: z.enum(["ativo", "inativo"]).optional(),
        isAdmin: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const passwordHash = data.password ? await hashPassword(data.password) : null;
    await withTransaction(async (client) => {
      if (data.nome || data.email || data.status || passwordHash) {
        await client.query(
          `
            update public.users
            set email = coalesce($2, email),
                display_name = coalesce($3, display_name),
                status = coalesce($4::public.user_status, status),
                password_hash = coalesce($5, password_hash),
                password_changed_at = case when $5::text is null then password_changed_at else now() end,
                updated_at = now()
            where id = $1::uuid
          `,
          [data.userId, data.email?.toLowerCase() ?? null, data.nome ?? null, data.status ?? null, passwordHash],
        );
        await client.query(
          `
            update public.profiles
            set nome = coalesce($2, nome),
                email = coalesce($3, email),
                status = coalesce($4::public.user_status, status),
                updated_at = now()
            where id = $1::uuid
          `,
          [data.userId, data.nome ?? null, data.email?.toLowerCase() ?? null, data.status ?? null],
        );
      }
      if (data.isAdmin !== undefined) {
        if (data.isAdmin) {
          await client.query(
            `
              insert into public.user_roles (user_id, role)
              values ($1::uuid, 'admin'::public.app_role)
              on conflict (user_id, role) do nothing
            `,
            [data.userId],
          );
        } else {
          await client.query(
            `delete from public.user_roles where user_id = $1::uuid and role = 'admin'::public.app_role`,
            [data.userId],
          );
        }
      }
      if (passwordHash || data.status === "inativo") {
        await client.query(
          `update public.auth_sessions set revoked_at = coalesce(revoked_at, now()) where user_id = $1::uuid and revoked_at is null`,
          [data.userId],
        );
      }
    });
    return { ok: true };
  });

export const deleteUserAdmin = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    await query(`delete from public.users where id = $1::uuid`, [data.userId]);
    return { ok: true };
  });

export const listUsersAdmin = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const result = await query(
      `
        select p.id, p.nome, p.email, p.status::text as status, p.created_at,
               exists (
                 select 1 from public.user_roles ur
                 where ur.user_id = p.id and ur.role = 'admin'::public.app_role
               ) as "isAdmin"
        from public.profiles p
        order by p.created_at desc
      `,
    );
    return result.rows;
  });

export const createProjectAdmin = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input) =>
    z
      .object({
        nome: z.string().min(1).max(255),
        empresa: z.string().max(255).optional(),
        responsavelId: z.string().uuid().optional().or(z.literal("")),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const responsavelId = data.responsavelId || null;
    const project = await withTransaction(async (client) => {
      const projectResult = await client.query<{ id: string }>(
        `
          insert into public.projects (nome, empresa, responsavel_id, created_by)
          values ($1, $2, $3::uuid, $4::uuid)
          returning id
        `,
        [data.nome, data.empresa || null, responsavelId, context.userId],
      );
      const projectId = projectResult.rows[0].id;
      const memberships = [
        { projectId, userId: context.userId, role: "admin" as const },
        ...(responsavelId && responsavelId !== context.userId
          ? [{ projectId, userId: responsavelId, role: "lider_estrategico" as const }]
          : []),
      ];
      for (const member of memberships) {
        await client.query(
          `
            insert into public.project_members (project_id, user_id, role)
            values ($1::uuid, $2::uuid, $3::public.project_role)
            on conflict (project_id, user_id) do update set role = excluded.role
          `,
          [member.projectId, member.userId, member.role],
        );
      }
      await client.query(
        `
          insert into public.project_history (project_id, user_id, acao, entidade, entidade_id, detalhes)
          values ($1::uuid, $2::uuid, 'projeto_criado', 'project', $1::uuid, jsonb_build_object('nome', $3::text))
        `,
        [projectId, context.userId, data.nome],
      );
      return { id: projectId };
    });
    return { id: project.id };
  });

export const attachUserToProjectAdmin = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input) =>
    z
      .object({
        projectId: z.string().uuid(),
        userId: z.string().uuid(),
        role: projectRoleSchema,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    await withTransaction(async (client) => {
      await client.query(
        `
          insert into public.project_members (project_id, user_id, role)
          values ($1::uuid, $2::uuid, $3::public.project_role)
          on conflict (project_id, user_id) do update set role = excluded.role
        `,
        [data.projectId, data.userId, data.role],
      );
      await client.query(
        `
          insert into public.project_history (project_id, user_id, acao, entidade, detalhes)
          values (
            $1::uuid,
            $2::uuid,
            'membro_vinculado',
            'member',
            jsonb_build_object('user_id', $3::uuid, 'role', $4::text)
          )
        `,
        [data.projectId, context.userId, data.userId, data.role],
      );
    });
    return { ok: true };
  });

export const updateProjectMemberRoleAdmin = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input) =>
    z.object({ memberId: z.string().uuid(), role: projectRoleSchema }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    await withTransaction(async (client) => {
      const memberResult = await client.query<{ project_id: string; user_id: string }>(
        `select project_id, user_id from public.project_members where id = $1::uuid`,
        [data.memberId],
      );
      const member = memberResult.rows[0];
      if (!member) throw new Error("Membro nao encontrado.");
      await client.query(
        `update public.project_members set role = $2::public.project_role where id = $1::uuid`,
        [data.memberId, data.role],
      );
      await client.query(
        `
          insert into public.project_history (project_id, user_id, acao, entidade, entidade_id, detalhes)
          values (
            $1::uuid,
            $2::uuid,
            'papel_membro_alterado',
            'member',
            $3::uuid,
            jsonb_build_object('user_id', $4::uuid, 'role', $5::text)
          )
        `,
        [member.project_id, context.userId, data.memberId, member.user_id, data.role],
      );
    });
    return { ok: true };
  });

export const removeProjectMemberAdmin = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input) => z.object({ memberId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    await withTransaction(async (client) => {
      const memberResult = await client.query<{ project_id: string; user_id: string }>(
        `select project_id, user_id from public.project_members where id = $1::uuid`,
        [data.memberId],
      );
      const member = memberResult.rows[0];
      if (!member) throw new Error("Membro nao encontrado.");
      await client.query(`delete from public.project_members where id = $1::uuid`, [data.memberId]);
      await client.query(
        `
          insert into public.project_history (project_id, user_id, acao, entidade, entidade_id, detalhes)
          values (
            $1::uuid,
            $2::uuid,
            'membro_removido',
            'member',
            $3::uuid,
            jsonb_build_object('user_id', $4::uuid)
          )
        `,
        [member.project_id, context.userId, data.memberId, member.user_id],
      );
    });
    return { ok: true };
  });
