import pg from "pg";

const apply = process.argv.includes("--apply");
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL nao esta configurada.");

const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
const client = await pool.connect();

try {
  const { rows } = await client.query(`
    select
      d.id,
      d.project_id,
      d.cargo as current_title,
      d.organization_position_id,
      p.nome as position_title
    from public.descricoes_cargo d
    left join public.project_positions p
      on p.id = d.organization_position_id
     and p.project_id = d.project_id
    order by d.project_id, d.created_at
  `);

  const eligible = rows.filter(
    (row) => row.position_title?.trim() && row.current_title?.trim() !== row.position_title.trim(),
  );
  const withoutLinkedPosition = rows.filter((row) => !row.position_title?.trim());

  if (apply && eligible.length) {
    await client.query("begin");
    try {
      await client.query(`
        update public.descricoes_cargo d
           set cargo = trim(p.nome)
          from public.project_positions p
         where p.id = d.organization_position_id
           and p.project_id = d.project_id
           and trim(p.nome) <> trim(d.cargo)
      `);
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  }

  process.stdout.write(
    `${JSON.stringify({
      mode: apply ? "applied" : "dry-run",
      projects: new Set(rows.map((row) => row.project_id)).size,
      descriptions: rows.length,
      titlesToUpdate: eligible.length,
      withoutLinkedPosition: withoutLinkedPosition.length,
      preview: eligible.slice(0, 20).map((row) => ({
        from: row.current_title,
        to: row.position_title,
      })),
    })}\n`,
  );
} finally {
  client.release();
  await pool.end();
}
