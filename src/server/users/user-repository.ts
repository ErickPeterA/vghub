import { query } from "@/server/db/pool";

export type LocalUser = {
  id: string;
  email: string;
  display_name: string | null;
  status: string;
  profile: {
    id: string;
    nome: string;
    email: string;
    status: string;
  } | null;
  roles: string[];
  isAdmin: boolean;
};

type LocalUserRow = {
  id: string;
  email: string;
  display_name: string | null;
  status: string;
  profile_id: string | null;
  profile_nome: string | null;
  profile_email: string | null;
  profile_status: string | null;
  roles: string[] | null;
};

export async function getLocalUserById(userId: string): Promise<LocalUser | null> {
  const result = await query<LocalUserRow>(
    `
      select
        u.id,
        u.email,
        u.display_name,
        u.status::text as status,
        p.id as profile_id,
        p.nome as profile_nome,
        p.email as profile_email,
        p.status::text as profile_status,
        coalesce(array_agg(ur.role::text) filter (where ur.role is not null), '{}') as roles
      from public.users u
      left join public.profiles p on p.id = u.id
      left join public.user_roles ur on ur.user_id = u.id
      where u.id = $1::uuid
      group by u.id, p.id
    `,
    [userId],
  );

  const row = result.rows[0];
  if (!row) return null;

  const roles = row.roles ?? [];
  return {
    id: row.id,
    email: row.email,
    display_name: row.display_name,
    status: row.status,
    profile:
      row.profile_id && row.profile_nome && row.profile_email && row.profile_status
        ? {
            id: row.profile_id,
            nome: row.profile_nome,
            email: row.profile_email,
            status: row.profile_status,
          }
        : null,
    roles,
    isAdmin: roles.includes("admin"),
  };
}

export async function listAssignableUsers() {
  const result = await query<{ id: string; nome: string; email: string }>(
    `
      select id, nome, email
      from public.profiles
      where status = 'ativo'::public.user_status
      order by nome
    `,
  );

  return result.rows;
}
