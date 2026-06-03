import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
    const profUpdate: Record<string, unknown> = {};
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
