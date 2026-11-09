import { readFile } from "node:fs/promises";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL não está configurada.");

const sql = await readFile(
  new URL("../supabase/migrations/20261109160000_invalidate_legacy_pam_pdfs.sql", import.meta.url),
  "utf8",
);
const pool = new Pool({ connectionString });
const client = await pool.connect();

try {
  await client.query("begin");
  await client.query(sql);
  await client.query("commit");
  const result = await client.query(`
    select count(*)::int as pams,
           count(*) filter (where pdf_data is null)::int as pdfs_ready_to_regenerate
      from public.pam
  `);
  console.log(JSON.stringify(result.rows[0]));
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  client.release();
  await pool.end();
}
