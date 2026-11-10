import { readFile } from "node:fs/promises";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL não está configurada.");

const migrationUrl = new URL(
  "../supabase/migrations/20261110143000_sync_experience_90_questionnaire.sql",
  import.meta.url,
);
const sql = await readFile(migrationUrl, "utf8");
const pool = new Pool({ connectionString });
const client = await pool.connect();

try {
  await client.query("begin");
  await client.query(sql);
  const result = await client.query(`
    select
      (select count(*)::int from public.performance_review_configs where review_type = 'experience') as configs,
      (select count(*)::int from public.performance_reviews where review_type = 'experience') as reviews,
      (select count(distinct project_id)::int from public.performance_reviews where review_type = 'experience') as projects,
      (select count(*)::int from public.performance_reviews
        where review_type = 'experience'
          and questions_snapshot @> '[{"id":"observacoes_adicionais"}]'::jsonb) as refreshed_reviews
  `);
  await client.query("commit");
  console.log(JSON.stringify(result.rows[0]));
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  client.release();
  await pool.end();
}
