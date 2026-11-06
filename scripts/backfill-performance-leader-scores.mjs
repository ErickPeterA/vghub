import pg from "pg";
import { createServer } from "vite";

const apply = process.argv.includes("--apply");
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL nao esta configurada.");

const vite = await createServer({ server: { middlewareMode: true }, appType: "custom" });
const scoring = await vite.ssrLoadModule("/src/components/PerformanceReviewManager.tsx");
const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
const client = await pool.connect();

try {
  const { rows: reviews } = await client.query(`
    select r.*,
      coalesce(jsonb_agg(to_jsonb(p) order by p.created_at)
        filter (where p.id is not null), '[]'::jsonb) as participants
    from public.performance_reviews r
    left join public.performance_review_participants p on p.review_id = r.id
    group by r.id
    order by r.created_at
  `);

  const updates = [];
  let skippedWithoutLeaderAnswer = 0;

  for (const review of reviews) {
    const leader = review.participants.find((item) => item.participant_type === "leader") ?? null;
    const collaborator =
      review.participants.find((item) => item.participant_type === "collaborator") ?? null;

    if (!leader || leader.status !== "answered") {
      skippedWithoutLeaderAnswer += 1;
      continue;
    }

    const questions = scoring.allReviewQuestions(review);
    const summary = scoring.buildComparisonScoreSummary(review, questions, collaborator, leader);
    const blocks = scoring.buildPerformanceBlockScores(review, questions, leader, summary);
    updates.push({
      id: review.id,
      projectId: review.project_id,
      status: review.status,
      snapshot: { ...summary, blocks },
    });
  }

  if (apply) {
    await client.query("begin");
    try {
      for (const update of updates) {
        await client.query(
          `update public.performance_reviews
             set score_summary_snapshot = $2::jsonb
           where id = $1::uuid`,
          [update.id, JSON.stringify(update.snapshot)],
        );
      }
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  }

  const { rows: verificationRows } = await client.query(`
    select
      count(*) filter (where leader.status = 'answered')::int as eligible,
      count(*) filter (
        where leader.status = 'answered'
          and r.score_summary_snapshot <> '{}'::jsonb
          and r.score_summary_snapshot ? 'blocks'
      )::int as persisted,
      count(*) filter (
        where leader.status = 'answered'
          and r.score_summary_snapshot->>'collaboratorFinalScore'
              is distinct from r.score_summary_snapshot->>'leaderFinalScore'
      )::int as inconsistent
    from public.performance_reviews r
    left join public.performance_review_participants leader
      on leader.review_id = r.id and leader.participant_type = 'leader'
  `);

  process.stdout.write(
    `${JSON.stringify({
      mode: apply ? "applied" : "dry-run",
      projects: new Set(reviews.map((item) => item.project_id)).size,
      reviews: reviews.length,
      recalculated: updates.length,
      finalizedRecalculated: updates.filter((item) => item.status === "finalized").length,
      skippedWithoutLeaderAnswer,
      verification: verificationRows[0],
    })}\n`,
  );
} finally {
  client.release();
  await pool.end();
  await vite.close();
}
