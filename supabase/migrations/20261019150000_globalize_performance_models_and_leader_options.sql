-- Performance and experience question models are system-wide.  Keep the global
-- records as the source of truth and persist the leader wording beside the
-- collaborator wording so it is visible in the configuration screen.
UPDATE public.performance_review_configs cfg
SET questions_schema = (
  SELECT COALESCE(
    jsonb_agg(
      CASE
        WHEN item.question ? 'leaderOptions' OR NOT COALESCE(options.changed, false)
          THEN item.question
        ELSE item.question || jsonb_build_object('leaderOptions', options.leader_options)
      END
      ORDER BY item.ordinality
    ),
    '[]'::jsonb
  )
  FROM jsonb_array_elements(cfg.questions_schema) WITH ORDINALITY AS item(question, ordinality)
  LEFT JOIN LATERAL (
    SELECT
      bool_or(option.value <> option.leader_value) AS changed,
      jsonb_agg(option.leader_value ORDER BY option.ordinality) AS leader_options
    FROM (
      SELECT
        value,
        ordinality,
        CASE
          WHEN value LIKE 'Me destaco ao usar esta habilidade%'
            THEN regexp_replace(value, '^Me destaco', 'O(a) colaborador(a) se destaca')
          WHEN value LIKE 'Utilizo na pratica esta habilidade%'
            THEN regexp_replace(value, '^Utilizo', 'O(a) colaborador(a) utiliza')
          WHEN value LIKE 'Preciso melhorar%'
            THEN regexp_replace(value, '^Preciso melhorar', 'O(a) colaborador(a) precisa melhorar')
          WHEN value LIKE 'Demonstro este comportamento%'
            THEN regexp_replace(value, '^Demonstro', 'O(a) colaborador(a) demonstra')
          WHEN value LIKE 'Supero os resultados%'
            THEN regexp_replace(value, '^Supero', 'O(a) colaborador(a) supera')
          WHEN value LIKE 'Atinjo os resultados%'
            THEN regexp_replace(value, '^Atinjo', 'O(a) colaborador(a) atinge')
          WHEN value LIKE 'Na maioria das vezes, atinjo%'
            THEN regexp_replace(value, '^Na maioria das vezes, atinjo', 'Na maioria das vezes, O(a) colaborador(a) atinge')
          WHEN value LIKE 'Na maioria das vezes, Nao atinjo%'
            THEN regexp_replace(value, '^Na maioria das vezes, Nao atinjo', 'Na maioria das vezes, O(a) colaborador(a) nao atinge')
          WHEN value LIKE 'Nao atinjo%'
            THEN regexp_replace(value, '^Nao atinjo', 'O(a) colaborador(a) nao atinge')
          ELSE value
        END AS leader_value
      FROM jsonb_array_elements_text(COALESCE(item.question->'options', '[]'::jsonb))
        WITH ORDINALITY AS values_list(value, ordinality)
    ) AS option
  ) AS options ON jsonb_typeof(item.question->'options') = 'array'
)
WHERE cfg.project_id IS NULL;
