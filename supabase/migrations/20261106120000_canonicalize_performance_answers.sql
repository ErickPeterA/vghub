-- Participant-specific wording is presentation-only. Persist the collaborator
-- option as the canonical value so equivalent answers compare and score equally.
CREATE OR REPLACE FUNCTION pg_temp.normalize_performance_answer(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(trim(translate(
    COALESCE(value, ''),
    'ÁÀÃÂÄÉÈÊËÍÌÎÏÓÒÕÔÖÚÙÛÜÇáàãâäéèêëíìîïóòõôöúùûüç',
    'AAAAAEEEEIIIIOOOOOUUUUCaaaaaeeeeiiiiooooouuuuc'
  )))
$$;

CREATE OR REPLACE FUNCTION pg_temp.canonicalize_performance_answers(
  answers jsonb,
  questions jsonb
)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    jsonb_object_agg(
      answer.key,
      COALESCE(
        (
          SELECT to_jsonb(collaborator_option.value)
          FROM jsonb_array_elements(COALESCE(questions, '[]'::jsonb)) AS question(value)
          CROSS JOIN LATERAL jsonb_array_elements_text(
            COALESCE(question.value->'leaderOptions', '[]'::jsonb)
          ) WITH ORDINALITY AS leader_option(value, ordinality)
          JOIN LATERAL jsonb_array_elements_text(
            COALESCE(question.value->'options', '[]'::jsonb)
          ) WITH ORDINALITY AS collaborator_option(value, ordinality)
            ON collaborator_option.ordinality = leader_option.ordinality
          WHERE question.value->>'id' = answer.key
            AND pg_temp.normalize_performance_answer(leader_option.value) =
                pg_temp.normalize_performance_answer(answer.value #>> '{}')
          LIMIT 1
        ),
        answer.value
      )
    ),
    '{}'::jsonb
  )
  FROM jsonb_each(COALESCE(answers, '{}'::jsonb)) AS answer(key, value)
$$;

UPDATE public.performance_review_participants AS participant
SET response_answers = pg_temp.canonicalize_performance_answers(
      participant.response_answers,
      review.questions_snapshot
    ),
    draft_answers = pg_temp.canonicalize_performance_answers(
      participant.draft_answers,
      review.questions_snapshot
    )
FROM public.performance_reviews AS review
WHERE review.id = participant.review_id
  AND (
    participant.response_answers <> pg_temp.canonicalize_performance_answers(
      participant.response_answers,
      review.questions_snapshot
    )
    OR participant.draft_answers <> pg_temp.canonicalize_performance_answers(
      participant.draft_answers,
      review.questions_snapshot
    )
  );
