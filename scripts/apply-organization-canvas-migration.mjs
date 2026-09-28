import { readFile } from "node:fs/promises";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL nao esta configurada.");

const migrationUrl = new URL(
  "../supabase/migrations/20260928120000_organization_free_canvas.sql",
  import.meta.url,
);
const sql = await readFile(migrationUrl, "utf8");
const pool = new pg.Pool({
  connectionString: databaseUrl,
  max: 1,
  connectionTimeoutMillis: 15_000,
});
const client = await pool.connect();

try {
  await client.query("begin");
  await client.query(sql);
  await client.query("commit");
  const result = await client.query(
    `select column_name from information_schema.columns
     where table_schema = 'public' and table_name = 'project_positions'
       and column_name in (
         'layout_x', 'layout_y', 'connection_source_handle', 'connection_target_handle'
       )`,
  );
  if (result.rowCount !== 4) throw new Error("As colunas do canvas nao foram criadas.");
  process.stdout.write("Migration do canvas livre aplicada e verificada.\n");
} catch (error) {
  await client.query("rollback").catch(() => undefined);
  throw error;
} finally {
  client.release();
  await pool.end();
}
