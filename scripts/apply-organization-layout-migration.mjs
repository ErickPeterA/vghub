import { readFile } from "node:fs/promises";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL nao esta configurada.");

const migrationUrl = new URL(
  "../supabase/migrations/20260924120000_organization_vertical_layout.sql",
  import.meta.url,
);
const sql = await readFile(migrationUrl, "utf8");
const pool = new pg.Pool({ connectionString: databaseUrl, max: 1, connectionTimeoutMillis: 15_000 });
const client = await pool.connect();

try {
  const existing = await client.query(
    `select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'project_positions'
       and column_name = 'visual_level'`,
  );
  if (existing.rowCount === 1) {
    process.stdout.write("Migration do layout do organograma ja estava aplicada.\n");
    process.exitCode = 0;
  } else {
  await client.query("begin");
  await client.query(sql);
  await client.query("commit");
  const result = await client.query(
    `select column_name from information_schema.columns
     where table_schema = 'public' and table_name = 'project_positions'
       and column_name = 'visual_level'`,
  );
  if (result.rowCount !== 1) throw new Error("A coluna visual_level nao foi criada.");
  process.stdout.write("Migration do layout do organograma aplicada e verificada.\n");
  }
} catch (error) {
  if (!client.queryable) throw error;
  await client.query("rollback").catch(() => undefined);
  throw error;
} finally {
  client.release();
  await pool.end();
}
