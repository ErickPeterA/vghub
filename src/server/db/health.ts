import { query } from "./pool";

type HealthRow = {
  database: string;
  now: Date;
};

export async function getDatabaseHealth() {
  const result = await query<HealthRow>("select current_database() as database, now() as now");
  const row = result.rows[0];

  return {
    database: row?.database ?? null,
    now: row?.now instanceof Date ? row.now.toISOString() : row?.now,
  };
}
