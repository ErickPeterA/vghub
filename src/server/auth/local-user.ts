import { HttpError } from "@/server/http/errors";
import { getLocalUserById, type LocalUser } from "@/server/users/user-repository";

export async function requireLocalUser(userId: string): Promise<LocalUser> {
  const user = await getLocalUserById(userId);
  if (!user) {
    throw new HttpError(
      403,
      "local_user_not_provisioned",
      "Usuario autenticado ainda nao foi provisionado no PostgreSQL.",
    );
  }

  if (user.status !== "ativo" || user.profile?.status === "inativo") {
    throw new HttpError(403, "local_user_inactive", "Usuario local inativo.");
  }

  return user;
}

export async function requireAdminUser(userId: string): Promise<LocalUser> {
  const user = await requireLocalUser(userId);
  if (!user.isAdmin) {
    throw new HttpError(403, "forbidden", "Acesso restrito a administradores.");
  }

  return user;
}
