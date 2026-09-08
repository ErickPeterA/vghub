import { readFile } from "node:fs/promises";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL nao esta configurada.");

const migrationUrl = new URL(
  "../supabase/migrations/20260908120000_local_auth.sql",
  import.meta.url,
);
const sql = await readFile(migrationUrl, "utf8");
const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
const client = await pool.connect();

try {
  await client.query("begin");
  await client.query(sql);
  await client.query("commit");
  process.stdout.write("Migration de Auth local aplicada.\n");
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  client.release();
  await pool.end();
}

