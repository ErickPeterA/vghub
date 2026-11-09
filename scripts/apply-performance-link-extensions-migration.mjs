import { readFile } from 'node:fs/promises'
import { Pool } from 'pg'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL não está configurada.')
}

const migrationUrl = new URL(
  '../supabase/migrations/20261109150000_performance_link_extensions.sql',
  import.meta.url,
)
const migrationSql = await readFile(migrationUrl, 'utf8')
const pool = new Pool({ connectionString })
const client = await pool.connect()

try {
  await client.query('begin')
  await client.query(migrationSql)
  await client.query('commit')

  const { rows } = await client.query(`
    select
      to_regclass('public.performance_link_extensions') is not null as migration_applied,
      count(*)::int as participants,
      count(distinct review_id)::int as reviews,
      count(distinct project_id)::int as projects,
      count(*) filter (
        where status <> 'answered'
          and expires_at > now()
      )::int as active_links,
      count(*) filter (
        where status <> 'answered'
          and expires_at <= now()
      )::int as expired_links
    from public.performance_review_participants
  `)

  console.log(JSON.stringify(rows[0]))
} catch (error) {
  await client.query('rollback')
  throw error
} finally {
  client.release()
  await pool.end()
}
