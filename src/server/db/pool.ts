import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { ensureServerEnvLoaded } from "@/server/env";

declare global {
  var __postgresPool: Pool | undefined;
}

function getDatabaseUrl() {
  ensureServerEnvLoaded();
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured");
  }
  return databaseUrl;
}

export function getPool() {
  if (!globalThis.__postgresPool) {
    globalThis.__postgresPool = new Pool({
      connectionString: getDatabaseUrl(),
      max: Number(process.env.PGPOOL_MAX ?? 10),
      idleTimeoutMillis: Number(process.env.PGPOOL_IDLE_TIMEOUT_MS ?? 30_000),
      connectionTimeoutMillis: Number(process.env.PGPOOL_CONNECTION_TIMEOUT_MS ?? 5_000),
    });
  }

  return globalThis.__postgresPool;
}

export async function query<T extends QueryResultRow>(text: string, values?: unknown[]) {
  return getPool().query<T>(text, values);
}

export async function withTransaction<T>(callback: (client: PoolClient) => Promise<T>) {
  const client = await getPool().connect();

  try {
    await client.query("begin");
    const result = await callback(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
