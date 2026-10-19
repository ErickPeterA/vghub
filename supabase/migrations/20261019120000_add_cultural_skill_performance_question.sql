UPDATE public.performance_review_configs
SET questions_schema =
  CASE
    WHEN jsonb_typeof(questions_schema) = 'array' THEN questions_schema
    ELSE '[]'::jsonb
  END || jsonb_build_array(
    jsonb_build_object(
      'id', 'avdp_habilidade_cultura',
      'label', 'Avaliacao da habilidade',
      'type', 'select',
      'required', true,
      'active', true,
      'options', jsonb_build_array(
        'Me destaco ao usar esta habilidade nas minhas atividades, sendo exemplo aos demais.',
        'Utilizo na pratica esta habilidade para garantir bons resultados nas minhas atividades',
        'Preciso melhorar UM POUCO na aplicacao desta habilidade, nas minhas atividades.',
        'Preciso melhorar MUITO na aplicacao desta habilidade, nesta atividade.',
        'Preciso melhorar URGENTEMENTE na aplicacao desta habilidade, nas minhas atividades.',
        'Nao se aplica.'
      ),
      'sectionTitle', 'Habilidades da cultura organizacional',
      'dynamicSource', 'culture_skills',
      'dynamicRole', 'rating'
    )
  )
WHERE COALESCE(review_type, 'experience') = 'performance'
  AND NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(questions_schema) = 'array' THEN questions_schema
        ELSE '[]'::jsonb
      END
    ) AS question
    WHERE question ->> 'dynamicSource' = 'culture_skills'
  );
