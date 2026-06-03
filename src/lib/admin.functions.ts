import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const projectRoleSchema = z.enum(["admin", "lider_estrategico", "lider_tatico", "lider_operacional", "gp"]);

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Apenas administradores podem executar esta ação.");
  return supabaseAdmin;
}

export const createUserAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      nome: z.string().min(1).max(255),
      email: z.string().email(),
      password: z.string().min(1).max(255),
      isAdmin: z.boolean().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context.userId);
    const { data: created, error } = await admin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { nome: data.nome },
    });
    if (error) throw new Error(error.message);
    const newId = created.user!.id;
    await admin.from("profiles").upsert({ id: newId, nome: data.nome, email: data.email });
    if (data.isAdmin) {
      await admin.from("user_roles").insert({ user_id: newId, role: "admin" });
    }
    return { id: newId };
  });

export const updateUserAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      userId: z.string().uuid(),
      nome: z.string().min(1).max(255).optional(),
      email: z.string().email().optional(),
      password: z.string().min(1).max(255).optional(),
      status: z.enum(["ativo", "inativo"]).optional(),
      isAdmin: z.boolean().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context.userId);
    const authUpdate: Record<string, unknown> = {};
    if (data.email) authUpdate.email = data.email;
    if (data.password) authUpdate.password = data.password;
    if (data.status) authUpdate.ban_duration = data.status === "inativo" ? "876000h" : "none";
    if (Object.keys(authUpdate).length > 0) {
      const { error } = await admin.auth.admin.updateUserById(data.userId, authUpdate);
      if (error) throw new Error(error.message);
    }
    const profUpdate: { nome?: string; email?: string; status?: "ativo" | "inativo" } = {};
    if (data.nome) profUpdate.nome = data.nome;
    if (data.email) profUpdate.email = data.email;
    if (data.status) profUpdate.status = data.status;
    if (Object.keys(profUpdate).length > 0) {
      await admin.from("profiles").update(profUpdate).eq("id", data.userId);
    }
    if (data.isAdmin !== undefined) {
      if (data.isAdmin) {
        await admin.from("user_roles").upsert({ user_id: data.userId, role: "admin" }, { onConflict: "user_id,role" });
      } else {
        await admin.from("user_roles").delete().eq("user_id", data.userId).eq("role", "admin");
      }
    }
    return { ok: true };
  });

export const deleteUserAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context.userId);
    const { error } = await admin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listUsersAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await assertAdmin(context.userId);
    const { data: profiles, error } = await admin
      .from("profiles")
      .select("id, nome, email, status, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const { data: roles } = await admin.from("user_roles").select("user_id, role").eq("role", "admin");
    const adminIds = new Set((roles ?? []).map((r) => r.user_id));
    return (profiles ?? []).map((p) => ({ ...p, isAdmin: adminIds.has(p.id) }));
  });

export const createProjectAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      nome: z.string().min(1).max(255),
      empresa: z.string().max(255).optional(),
      responsavelId: z.string().uuid().optional().or(z.literal("")),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context.userId);
    const responsavelId = data.responsavelId || null;
    const { data: project, error } = await admin
      .from("projects")
      .insert({
        nome: data.nome,
        empresa: data.empresa || null,
        responsavel_id: responsavelId,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const memberships = [
      { project_id: project.id, user_id: context.userId, role: "admin" as const },
      ...(responsavelId && responsavelId !== context.userId
        ? [{ project_id: project.id, user_id: responsavelId, role: "lider_estrategico" as const }]
        : []),
    ];
    const { error: memberError } = await admin
      .from("project_members")
      .upsert(memberships, { onConflict: "project_id,user_id" });
    if (memberError) throw new Error(memberError.message);

    await admin.from("project_history").insert({
      project_id: project.id,
      user_id: context.userId,
      acao: "projeto_criado",
      entidade: "project",
      entidade_id: project.id,
      detalhes: { nome: data.nome },
    });
    return { id: project.id };
  });

export const attachUserToProjectAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      projectId: z.string().uuid(),
      userId: z.string().uuid(),
      role: projectRoleSchema,
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context.userId);
    const { error } = await admin
      .from("project_members")
      .upsert({ project_id: data.projectId, user_id: data.userId, role: data.role }, { onConflict: "project_id,user_id" });
    if (error) throw new Error(error.message);
    await admin.from("project_history").insert({
      project_id: data.projectId,
      user_id: context.userId,
      acao: "membro_vinculado",
      entidade: "member",
      detalhes: { user_id: data.userId, role: data.role },
    });
    return { ok: true };
  });

export const updateProjectMemberRoleAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ memberId: z.string().uuid(), role: projectRoleSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context.userId);
    const { data: member, error: readError } = await admin
      .from("project_members")
      .select("project_id,user_id")
      .eq("id", data.memberId)
      .single();
    if (readError) throw new Error(readError.message);
    const { error } = await admin.from("project_members").update({ role: data.role }).eq("id", data.memberId);
    if (error) throw new Error(error.message);
    await admin.from("project_history").insert({
      project_id: member.project_id,
      user_id: context.userId,
      acao: "papel_membro_alterado",
      entidade: "member",
      entidade_id: data.memberId,
      detalhes: { user_id: member.user_id, role: data.role },
    });
    return { ok: true };
  });

export const removeProjectMemberAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ memberId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context.userId);
    const { data: member, error: readError } = await admin
      .from("project_members")
      .select("project_id,user_id")
      .eq("id", data.memberId)
      .single();
    if (readError) throw new Error(readError.message);
    const { error } = await admin.from("project_members").delete().eq("id", data.memberId);
    if (error) throw new Error(error.message);
    await admin.from("project_history").insert({
      project_id: member.project_id,
      user_id: context.userId,
      acao: "membro_removido",
      entidade: "member",
      entidade_id: data.memberId,
      detalhes: { user_id: member.user_id },
    });
    return { ok: true };
  });
