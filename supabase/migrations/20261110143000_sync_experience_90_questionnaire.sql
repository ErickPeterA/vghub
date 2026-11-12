-- Synchronizes the 90-day experience questionnaire with the AVEXP90d workbook.
-- Existing answer keys are deliberately retained whenever the question already
-- existed, so participant answers and their history are not discarded.

CREATE OR REPLACE FUNCTION pg_temp.experience_90_questionnaire()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT '[
    {"id":"treinamento_recebendo","label":"Você está recebendo algum treinamento e/ou orientação para executar seu trabalho?","leaderLabel":"O(a) colaborador(a) está recebendo algum treinamento e/ou orientação para executar seu trabalho?","type":"select","required":true,"active":true,"options":["Sim","Não"],"sectionTitle":"Treinamentos, orientações e aprendizado"},
    {"id":"treinamento_quais","label":"Quais? Descreva:","type":"textarea","required":false,"active":true,"sectionTitle":"Treinamentos, orientações e aprendizado"},
    {"id":"aprendizado_atividades","label":"Você está aprendendo o que é ensinado das suas atividades?","leaderLabel":"O(a) colaborador(a) está aprendendo o que é ensinado das suas atividades?","type":"select","required":true,"active":true,"options":["Sim","Não"],"sectionTitle":"Treinamentos, orientações e aprendizado"},
    {"id":"aprendizado_comente","label":"Comente:","type":"textarea","required":false,"active":true,"sectionTitle":"Treinamentos, orientações e aprendizado"},
    {"id":"relacionamento_colegas","label":"Como é o seu relacionamento com os colegas?","leaderLabel":"Como é o relacionamento do(a) colaborador(a) com os colegas?","type":"select","required":true,"active":true,"options":["Ótimo","Bom","Regular - Justificar o porquê e exemplificar nas observações","Ruim - Justificar o porquê e exemplificar nas observações"],"sectionTitle":"Relacionamento"},
    {"id":"relacionamento_colegas_comente","label":"Comente:","type":"textarea","required":false,"active":true,"sectionTitle":"Relacionamento"},
    {"id":"relacionamento_superior","label":"Como é o seu relacionamento com seu superior imediato?","leaderLabel":"Como é o relacionamento do(a) colaborador(a) com você?","type":"select","required":true,"active":true,"options":["Ótimo","Bom","Regular - Justificar o porquê e exemplificar nas observações","Ruim - Justificar o porquê e exemplificar nas observações"],"sectionTitle":"Relacionamento"},
    {"id":"relacionamento_superior_comente","label":"Comente:","type":"textarea","required":false,"active":true,"sectionTitle":"Relacionamento"},
    {"id":"dialogo_trabalho","label":"Seu superior imediato mantém diálogo a respeito de seu trabalho, permitindo-lhe expor suas ideias, dificuldades, etc.?","leaderLabel":"Você mantém diálogo a respeito do trabalho do(a) colaborador(a), permitindo que exponha suas ideias, dificuldades, etc.?","type":"select","required":true,"active":true,"options":["Sim","Não"],"sectionTitle":"Relacionamento"},
    {"id":"dialogo_trabalho_comente","label":"Comente:","type":"textarea","required":false,"active":true,"sectionTitle":"Relacionamento"},
    {"id":"desempenho_atividades","label":"Como você avalia o seu desempenho nas atividades?","leaderLabel":"Como você avalia o desempenho do(a) colaborador(a) nas atividades?","type":"select","required":true,"active":true,"options":["Ótimo","Bom","Regular - Justificar o porquê e exemplificar nas observações","Ruim - Justificar o porquê e exemplificar nas observações"],"sectionTitle":"Autoavaliação do dia a dia de trabalho"},
    {"id":"desempenho_atividades_comente","label":"Comente:","type":"textarea","required":false,"active":true,"sectionTitle":"Autoavaliação do dia a dia de trabalho"},
    {"id":"duvidas_dificuldades_atitude","label":"Quando você tem alguma dúvida ou dificuldades no trabalho, qual é sua atitude?","leaderLabel":"Quando o(a) colaborador(a) tem alguma dúvida ou dificuldades no trabalho, qual é a atitude?","type":"select","required":true,"active":true,"options":["Resolvo sozinho","Solicito ajuda ao colega","Dirijo-me ao meu supervisor","Nunca peço ajuda"],"leaderOptions":["Resolve sozinho(a)","Solicita ajuda ao colega","Dirige-se a mim, supervisor","Nunca pede ajuda"],"sectionTitle":"Autoavaliação do dia a dia de trabalho"},
    {"id":"duvidas_dificuldades_comente","label":"Comente:","type":"textarea","required":false,"active":true,"sectionTitle":"Autoavaliação do dia a dia de trabalho"},
    {"id":"metodo_empresa","label":"Você está desempenhando seu trabalho conforme o método utilizado pela empresa ou alterou algo?","leaderLabel":"O(a) colaborador(a) está desempenhando o trabalho conforme o método utilizado pela empresa ou alterou algo?","type":"select","required":true,"active":true,"options":["Sigo os padrões da empresa","Sigo os padrões, mas alterei algumas coisas","Trabalho no meu método"],"leaderOptions":["Segue os padrões da empresa","Segue os padrões, mas alterou algumas coisas","Trabalha no seu método"],"sectionTitle":"Autoavaliação do dia a dia de trabalho"},
    {"id":"metodo_empresa_comente","label":"Comente:","type":"textarea","required":false,"active":true,"sectionTitle":"Autoavaliação do dia a dia de trabalho"},
    {"id":"metodo_rendimento","label":"No caso de utilizar em parte, ou completamente seu método, houve maior rendimento?","type":"select","required":false,"active":true,"options":["Sim","Não"],"sectionTitle":"Autoavaliação do dia a dia de trabalho"},
    {"id":"metodo_rendimento_comente","label":"Comente:","type":"textarea","required":false,"active":true,"sectionTitle":"Autoavaliação do dia a dia de trabalho"},
    {"id":"satisfacao_trabalho","label":"Você está satisfeito com o trabalho que executa?","leaderLabel":"Você está satisfeito com o trabalho que o(a) colaborador(a) executa?","type":"select","required":true,"active":true,"options":["Sim","Não"],"sectionTitle":"Satisfação"},
    {"id":"satisfacao_comente","label":"Comente:","type":"textarea","required":false,"active":true,"sectionTitle":"Satisfação"},
    {"id":"avexp90_habilidades","label":"Avaliação da habilidade","type":"select","required":true,"active":true,"options":["Me destaco ao usar esta habilidade nas minhas atividades, sendo exemplo aos demais.","Utilizo na prática esta habilidade para garantir bons resultados nas minhas atividades","Preciso melhorar UM POUCO na aplicação desta habilidade, nas minhas atividades.","Preciso melhorar MUITO na aplicação desta habilidade, nesta atividade.","Preciso melhorar URGENTEMENTE na aplicação desta habilidade, nas minhas atividades.","Não se aplica."],"sectionTitle":"Autoavaliação em habilidades, postura e comportamento","dynamicSource":"role_skills","dynamicRole":"rating"},
    {"id":"avexp90_postura_comportamento","label":"Avaliação da postura e do comportamento","type":"select","required":true,"active":true,"options":["Demonstro este comportamento no dia a dia, a ponto de me DESTACAR perante os demais colaboradores.","Demonstro este comportamento no dia a dia.","Preciso MELHORAR neste comportamento em POUCAS situações.","Preciso MELHORAR neste comportamento em MUITAS situações.","Preciso MELHORAR URGENTEMENTE neste comportamento.","Não se aplica."],"sectionTitle":"Autoavaliação em habilidades, postura e comportamento","dynamicSource":"behavior","dynamicRole":"rating"},
    {"id":"observacoes_adicionais","label":"Observações e comentários adicionais:","type":"textarea","required":false,"active":true,"sectionTitle":"Observações e comentários adicionais"},
    {"id":"acao_efetivo","label":"Ação a ser tomada (efetivo):","type":"textarea","required":false,"active":true,"audience":"leader","sectionTitle":"Ações do líder"},
    {"id":"acao_estagio","label":"Ação a ser tomada (estágio):","type":"textarea","required":false,"active":true,"audience":"leader","sectionTitle":"Ações do líder"},
    {"id":"acao_justificativa","label":"Justificativa:","type":"textarea","required":false,"active":true,"audience":"leader","sectionTitle":"Ações do líder"}
  ]'::jsonb
$$;

-- Materializes the cargo-specific questions for review snapshots.  This is the
-- same shape used when a new review is created, and lets old validated reviews
-- display every question from the new standard without altering prior answers.
CREATE OR REPLACE FUNCTION pg_temp.expand_experience_90_questions(
  questionnaire jsonb,
  description_snapshot jsonb
)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(jsonb_agg(resolved.question ORDER BY resolved.position), '[]'::jsonb)
  FROM (
    SELECT template.ordinality::numeric AS position, template.question
    FROM jsonb_array_elements(questionnaire) WITH ORDINALITY AS template(question, ordinality)
    WHERE NOT (template.question ? 'dynamicSource')

    UNION ALL

    SELECT
      template.ordinality::numeric + item.ordinality / 1000.0 AS position,
      template.question || jsonb_build_object(
        'id', (template.question->>'id') || '_' || item.ordinality,
        'source', 'job_description',
        'groupId', (template.question->>'dynamicSource') || '_' || item.ordinality,
        'groupTitle', COALESCE(
          item.value->>'habilidade_cargo',
          item.value->>'habilidade_do_cargo',
          item.value->>'habilidade',
          item.value->>'competencia',
          item.value->>'competência',
          item.value->>'postura_comportamento',
          item.value->>'postura',
          item.value->>'comportamento',
          (
            SELECT entry.value #>> '{}'
            FROM jsonb_each(item.value) AS entry(key, value)
            WHERE jsonb_typeof(entry.value) = 'string'
              AND length(trim(entry.value #>> '{}')) > 0
            ORDER BY length(entry.value #>> '{}') DESC
            LIMIT 1
          ),
          CASE WHEN template.question->>'dynamicSource' = 'behavior'
            THEN 'Postura e comportamento ' || item.ordinality
            ELSE 'Habilidade ' || item.ordinality
          END
        )
      ) AS question
    FROM jsonb_array_elements(questionnaire) WITH ORDINALITY AS template(question, ordinality)
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE template.question->>'dynamicSource'
        WHEN 'role_skills' THEN COALESCE(description_snapshot->'habilidades_cargo', description_snapshot->'dynamic_values'->'habilidades_cargo', '[]'::jsonb)
        WHEN 'behavior' THEN COALESCE(description_snapshot->'postura', description_snapshot->'dynamic_values'->'postura', '[]'::jsonb)
        ELSE '[]'::jsonb
      END
    ) WITH ORDINALITY AS item(value, ordinality)
    WHERE template.question ? 'dynamicSource'
  ) AS resolved
$$;

-- The workbook is the complete experience questionnaire.  Replacing the old
-- schema prevents legacy questions from being appended after the configured
-- blocks; saved answer keys remain preserved on participant responses.
CREATE OR REPLACE FUNCTION pg_temp.merge_experience_questions(
  current_questions jsonb,
  canonical_questions jsonb
)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(canonical_questions, '[]'::jsonb)
$$;

-- The global record is the source for future projects.  Update every project
-- record explicitly as well, including inactive configurations, so all current
-- settings show the same workbook-based questionnaire.
CREATE TEMP TABLE pg_temp.previous_project_experience_configs ON COMMIT DROP AS
SELECT id, questions_schema
FROM public.performance_review_configs
WHERE project_id IS NOT NULL
  AND review_type = 'experience';

UPDATE public.performance_review_configs
SET name = 'Avaliação de Experiência',
    questions_schema = pg_temp.merge_experience_questions(
      questions_schema,
      pg_temp.experience_90_questionnaire()
    ),
    updated_at = now()
WHERE review_type = 'experience';

-- The global-config trigger updates active project configs.  Restore their
-- project-only questions from the transaction-local backup before merging the
-- workbook questions, so no customized setting is lost.
UPDATE public.performance_review_configs AS config
SET questions_schema = pg_temp.merge_experience_questions(
      previous.questions_schema,
      pg_temp.experience_90_questionnaire()
    ),
    updated_at = now()
FROM pg_temp.previous_project_experience_configs AS previous
WHERE config.id = previous.id;

-- Review snapshots are intentionally refreshed too: public links and completed
-- comparisons read this persisted snapshot rather than the current config.
UPDATE public.performance_reviews
SET questions_snapshot = pg_temp.merge_experience_questions(
      questions_snapshot,
      pg_temp.expand_experience_90_questions(
        pg_temp.experience_90_questionnaire(),
        COALESCE(job_description_snapshot, '{}'::jsonb)
      )
    )
WHERE review_type = 'experience';
