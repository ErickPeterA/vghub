import { query } from "@/server/db/pool";

export async function assertAdminPostgres(userId: string) {
  const result = await query<{ allowed: boolean }>(`select public.is_admin($1::uuid) as allowed`, [
    userId,
  ]);
  if (!result.rows[0]?.allowed) {
    throw new Error("Apenas administradores podem executar esta acao.");
  }
}
