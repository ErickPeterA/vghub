-- Corrige modelos e avaliações já criadas, pois os formulários públicos usam snapshots persistidos.
CREATE FUNCTION pg_temp.fix_performance_accents(value jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT replace(
    replace(
      replace(
        replace(
          replace(
            replace(
              replace(
                replace(
                  replace(
                    replace(
                      replace(
                        replace(
                          replace(
                            replace(
                              replace(
                                replace(
                                  replace(
                                    replace(
                                      replace(value::text,
                                        'maior instrucao que', 'maior instrução que'),
                                      '"sectionTitle": "Instrucao"', '"sectionTitle": "Instrução"'),
                                    'a experiencia que', 'a experiência que'),
                                  '"sectionTitle": "Experiencia"', '"sectionTitle": "Experiência"'),
                                'EFICIENCIA', 'EFICIÊNCIA'),
                              'EFICACIA', 'EFICÁCIA'),
                            'Ensino Medio', 'Ensino Médio'),
                          'Ensino Tecnico', 'Ensino Técnico'),
                        'Pos-graduacao', 'Pós-graduação'),
                      'metodo', 'método'),
                    'tambem', 'também'),
                  'alguem', 'alguém'),
                'executa-la', 'executá-la'),
              'auxilio', 'auxílio'),
            'Nao', 'Não'),
          'NAO', 'NÃO'),
        'pratica', 'prática'),
      'aplicacao', 'aplicação'),
    'situacoes', 'situações')::jsonb;
$$;

UPDATE public.performance_review_configs
SET questions_schema = replace(
  pg_temp.fix_performance_accents(questions_schema)::text,
  'especificas',
  'específicas'
)::jsonb
WHERE project_id IS NULL;

UPDATE public.performance_reviews
SET questions_snapshot = replace(
  pg_temp.fix_performance_accents(questions_snapshot)::text,
  'especificas',
  'específicas'
)::jsonb
WHERE review_type = 'performance';
