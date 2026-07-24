CREATE TEMP TABLE experience_review_question_templates ON COMMIT DROP AS
SELECT *
FROM (VALUES
    (
      '30 dias',
      30,
      'experience',
      $$[
        {"id":"normas_recebeu_informacoes","label":"Ao ingressar na empresa você recebeu informações com relação às normas internas e regras da empresa?","leaderLabel":"Ao ingressar na empresa o(a) colaborador(a) recebeu informações com relação às normas internas e regras da empresa?","type":"select","required":true,"active":true,"options":["Sim","Não"],"helpText":"Normas e regras da empresa"},
        {"id":"normas_informacoes_foram","label":"Essas informações foram:","type":"select","required":true,"active":true,"options":["Suficientes","Insuficientes"],"helpText":"Normas e regras da empresa"},
        {"id":"normas_faltaram_tipo","label":"Se insuficientes, faltaram informações:","type":"select","required":false,"active":true,"options":["Administrativas","Técnicas"],"helpText":"Normas e regras da empresa"},
        {"id":"normas_faltaram_descricao","label":"Quais informações faltaram? Descreva:","type":"textarea","required":false,"active":true,"helpText":"Normas e regras da empresa"},
        {"id":"treinamento_recebeu","label":"Você recebeu ou recebe algum treinamento e/ou orientação para executar seu trabalho?","leaderLabel":"O(a) colaborador(a) recebeu ou recebe algum treinamento e/ou orientação para executar seu trabalho?","type":"select","required":true,"active":true,"options":["Sim","Não"],"helpText":"Treinamentos, orientações, adaptação e aprendizado"},
        {"id":"treinamento_quais","label":"Quais? Descreva:","type":"textarea","required":false,"active":true,"helpText":"Treinamentos, orientações, adaptação e aprendizado"},
        {"id":"adaptacao_dificuldades","label":"Você apresentou dificuldades para adaptar-se ao ambiente de trabalho?","leaderLabel":"O(a) colaborador(a) apresentou dificuldades para adaptar-se ao ambiente de trabalho?","type":"select","required":true,"active":true,"options":["Sim","Não"],"helpText":"Treinamentos, orientações, adaptação e aprendizado"},
        {"id":"adaptacao_dificuldades_descricao","label":"Se apresentou dificuldades, quais foram? Descreva:","type":"textarea","required":false,"active":true,"helpText":"Treinamentos, orientações, adaptação e aprendizado"},
        {"id":"adaptacao_como","label":"Como está sua adaptação?","type":"select","required":true,"active":true,"options":["Lenta","Normal","Rápida"],"helpText":"Treinamentos, orientações, adaptação e aprendizado"},
        {"id":"adaptacao_mais","label":"Em que você mais se adaptou? Descreva:","leaderLabel":"Em que o(a) colaborador(a) mais se adaptou? Descreva:","type":"textarea","required":false,"active":true,"helpText":"Treinamentos, orientações, adaptação e aprendizado"},
        {"id":"aprendizado_atividades","label":"Você está aprendendo o que é ensinado das suas atividades?","leaderLabel":"O(a) colaborador(a) está aprendendo o que é ensinado das suas atividades?","type":"select","required":true,"active":true,"options":["Sim","Não"],"helpText":"Treinamentos, orientações, adaptação e aprendizado"},
        {"id":"aprendizado_comente","label":"Comente:","type":"textarea","required":false,"active":true,"helpText":"Treinamentos, orientações, adaptação e aprendizado"},
        {"id":"relacionamento_colegas","label":"Como é o seu relacionamento com os colegas?","leaderLabel":"Como é o relacionamento do(a) colaborador(a) com os colegas?","type":"select","required":true,"active":true,"options":["Ótimo","Bom","Regular - Justificar o porquê e exemplificar nas observações","Ruim - Justificar o porquê e exemplificar nas observações"],"helpText":"Relacionamento"},
        {"id":"relacionamento_colegas_comente","label":"Comente:","type":"textarea","required":false,"active":true,"helpText":"Relacionamento"},
        {"id":"relacionamento_superior","label":"Como é o seu relacionamento com seu superior imediato?","leaderLabel":"Como é o relacionamento do(a) colaborador(a) com você?","type":"select","required":true,"active":true,"options":["Ótimo","Bom","Regular - Justificar o porquê e exemplificar nas observações","Ruim - Justificar o porquê e exemplificar nas observações"],"helpText":"Relacionamento"},
        {"id":"relacionamento_superior_comente","label":"Comente:","type":"textarea","required":false,"active":true,"helpText":"Relacionamento"},
        {"id":"dialogo_trabalho","label":"Seu superior imediato mantém diálogo a respeito de seu trabalho, permitindo-lhe expor suas ideias, dificuldades, etc.?","leaderLabel":"Você mantém diálogo a respeito do trabalho do(a) colaborador(a), permitindo que exponha suas ideias, dificuldades, etc.?","type":"select","required":true,"active":true,"options":["Sim","Não"],"helpText":"Relacionamento"},
        {"id":"dialogo_trabalho_comente","label":"Comente:","type":"textarea","required":false,"active":true,"helpText":"Relacionamento"},
        {"id":"satisfacao_trabalho","label":"Você está satisfeito com o trabalho que executa?","leaderLabel":"Você está satisfeito com o trabalho que o(a) colaborador(a) executa?","type":"select","required":true,"active":true,"options":["Sim","Não"],"helpText":"Satisfação"},
        {"id":"satisfacao_comente","label":"Comente:","type":"textarea","required":false,"active":true,"helpText":"Satisfação"},
        {"id":"observacoes_adicionais","label":"Observações e comentários adicionais:","type":"textarea","required":false,"active":true}
      ]$$::jsonb
    ),
    (
      '45 dias',
      45,
      'experience',
      $$[
        {"id":"normas_recebeu_informacoes","label":"Ao ingressar na empresa você recebeu informações com relação às normas internas e regras da empresa?","leaderLabel":"Ao ingressar na empresa o(a) colaborador(a) recebeu informações com relação às normas internas e regras da empresa?","type":"select","required":true,"active":true,"options":["Sim","Não"],"helpText":"Normas e regras da empresa"},
        {"id":"normas_informacoes_foram","label":"Essas informações foram:","type":"select","required":true,"active":true,"options":["Suficientes","Insuficientes"],"helpText":"Normas e regras da empresa"},
        {"id":"normas_faltaram_tipo","label":"Se insuficientes, faltaram informações:","type":"select","required":false,"active":true,"options":["Administrativas","Técnicas"],"helpText":"Normas e regras da empresa"},
        {"id":"normas_faltaram_descricao","label":"Quais informações faltaram? Descreva:","type":"textarea","required":false,"active":true,"helpText":"Normas e regras da empresa"},
        {"id":"treinamento_recebeu","label":"Você recebeu ou recebe algum treinamento e/ou orientação para executar seu trabalho?","leaderLabel":"O(a) colaborador(a) recebeu ou recebe algum treinamento e/ou orientação para executar seu trabalho?","type":"select","required":true,"active":true,"options":["Sim","Não"],"helpText":"Treinamentos, orientações, adaptação e aprendizado"},
        {"id":"treinamento_quais","label":"Quais? Descreva:","type":"textarea","required":false,"active":true,"helpText":"Treinamentos, orientações, adaptação e aprendizado"},
        {"id":"adaptacao_dificuldades","label":"Você apresentou dificuldades para adaptar-se ao ambiente de trabalho?","leaderLabel":"O(a) colaborador(a) apresentou dificuldades para adaptar-se ao ambiente de trabalho?","type":"select","required":true,"active":true,"options":["Sim","Não"],"helpText":"Treinamentos, orientações, adaptação e aprendizado"},
        {"id":"adaptacao_dificuldades_descricao","label":"Se apresentou dificuldades, quais foram? Descreva:","type":"textarea","required":false,"active":true,"helpText":"Treinamentos, orientações, adaptação e aprendizado"},
        {"id":"adaptacao_como","label":"Como está sua adaptação?","type":"select","required":true,"active":true,"options":["Lenta","Normal","Rápida"],"helpText":"Treinamentos, orientações, adaptação e aprendizado"},
        {"id":"adaptacao_mais","label":"Em que você mais se adaptou? Descreva:","leaderLabel":"Em que o(a) colaborador(a) mais se adaptou? Descreva:","type":"textarea","required":false,"active":true,"helpText":"Treinamentos, orientações, adaptação e aprendizado"},
        {"id":"aprendizado_atividades","label":"Você está aprendendo o que é ensinado das suas atividades?","leaderLabel":"O(a) colaborador(a) está aprendendo o que é ensinado das suas atividades?","type":"select","required":true,"active":true,"options":["Sim","Não"],"helpText":"Treinamentos, orientações, adaptação e aprendizado"},
        {"id":"aprendizado_comente","label":"Comente:","type":"textarea","required":false,"active":true,"helpText":"Treinamentos, orientações, adaptação e aprendizado"},
        {"id":"relacionamento_colegas","label":"Como é o seu relacionamento com os colegas?","leaderLabel":"Como é o relacionamento do(a) colaborador(a) com os colegas?","type":"select","required":true,"active":true,"options":["Ótimo","Bom","Regular - Justificar o porquê e exemplificar nas observações","Ruim - Justificar o porquê e exemplificar nas observações"],"helpText":"Relacionamento"},
        {"id":"relacionamento_colegas_comente","label":"Comente:","type":"textarea","required":false,"active":true,"helpText":"Relacionamento"},
        {"id":"relacionamento_superior","label":"Como é o seu relacionamento com seu superior imediato?","leaderLabel":"Como é o relacionamento do(a) colaborador(a) com você?","type":"select","required":true,"active":true,"options":["Ótimo","Bom","Regular - Justificar o porquê e exemplificar nas observações","Ruim - Justificar o porquê e exemplificar nas observações"],"helpText":"Relacionamento"},
        {"id":"relacionamento_superior_comente","label":"Comente:","type":"textarea","required":false,"active":true,"helpText":"Relacionamento"},
        {"id":"dialogo_trabalho","label":"Seu superior imediato mantém diálogo a respeito de seu trabalho, permitindo-lhe expor suas ideias, dificuldades, etc.?","leaderLabel":"Você mantém diálogo a respeito do trabalho do(a) colaborador(a), permitindo que exponha suas ideias, dificuldades, etc.?","type":"select","required":true,"active":true,"options":["Sim","Não"],"helpText":"Relacionamento"},
        {"id":"dialogo_trabalho_comente","label":"Comente:","type":"textarea","required":false,"active":true,"helpText":"Relacionamento"},
        {"id":"satisfacao_trabalho","label":"Você está satisfeito com o trabalho que executa?","leaderLabel":"Você está satisfeito com o trabalho que o(a) colaborador(a) executa?","type":"select","required":true,"active":true,"options":["Sim","Não"],"helpText":"Satisfação"},
        {"id":"satisfacao_comente","label":"Comente:","type":"textarea","required":false,"active":true,"helpText":"Satisfação"},
        {"id":"observacoes_adicionais","label":"Observações e comentários adicionais:","type":"textarea","required":false,"active":true}
      ]$$::jsonb
    ),
    (
      '90 dias',
      90,
      'experience',
      $$[
        {"id":"treinamento_recebendo","label":"Você está recebendo algum treinamento e/ou orientação para executar seu trabalho?","leaderLabel":"O(a) colaborador(a) está recebendo algum treinamento e/ou orientação para executar seu trabalho?","type":"select","required":true,"active":true,"options":["Sim","Não"],"helpText":"Treinamentos, orientações e aprendizado"},
        {"id":"treinamento_quais","label":"Quais? Descreva:","type":"textarea","required":false,"active":true,"helpText":"Treinamentos, orientações e aprendizado"},
        {"id":"aprendizado_atividades","label":"Você está aprendendo o que é ensinado das suas atividades?","leaderLabel":"O(a) colaborador(a) está aprendendo o que é ensinado das suas atividades?","type":"select","required":true,"active":true,"options":["Sim","Não"],"helpText":"Treinamentos, orientações e aprendizado"},
        {"id":"aprendizado_comente","label":"Comente:","type":"textarea","required":false,"active":true,"helpText":"Treinamentos, orientações e aprendizado"},
        {"id":"relacionamento_colegas","label":"Como é o seu relacionamento com os colegas?","leaderLabel":"Como é o relacionamento do(a) colaborador(a) com os colegas?","type":"select","required":true,"active":true,"options":["Ótimo","Bom","Regular - Justificar o porquê e exemplificar nas observações","Ruim - Justificar o porquê e exemplificar nas observações"],"helpText":"Relacionamento"},
        {"id":"relacionamento_colegas_comente","label":"Comente:","type":"textarea","required":false,"active":true,"helpText":"Relacionamento"},
        {"id":"relacionamento_superior","label":"Como é o seu relacionamento com seu superior imediato?","leaderLabel":"Como é o relacionamento do(a) colaborador(a) com você?","type":"select","required":true,"active":true,"options":["Ótimo","Bom","Regular - Justificar o porquê e exemplificar nas observações","Ruim - Justificar o porquê e exemplificar nas observações"],"helpText":"Relacionamento"},
        {"id":"relacionamento_superior_comente","label":"Comente:","type":"textarea","required":false,"active":true,"helpText":"Relacionamento"},
        {"id":"dialogo_trabalho","label":"Seu superior imediato mantém diálogo a respeito de seu trabalho, permitindo-lhe expor suas ideias, dificuldades, etc.?","leaderLabel":"Você mantém diálogo a respeito do trabalho do(a) colaborador(a), permitindo que exponha suas ideias, dificuldades, etc.?","type":"select","required":true,"active":true,"options":["Sim","Não"],"helpText":"Relacionamento"},
        {"id":"dialogo_trabalho_comente","label":"Comente:","type":"textarea","required":false,"active":true,"helpText":"Relacionamento"},
        {"id":"desempenho_atividades","label":"Como você avalia o seu desempenho nas atividades?","leaderLabel":"Como você avalia o desempenho do(a) colaborador(a) nas atividades?","type":"select","required":true,"active":true,"options":["Ótimo","Bom","Regular - Justificar o porquê e exemplificar nas observações","Ruim - Justificar o porquê e exemplificar nas observações"],"helpText":"Autoavaliação do dia a dia de trabalho"},
        {"id":"desempenho_atividades_comente","label":"Comente:","type":"textarea","required":false,"active":true,"helpText":"Autoavaliação do dia a dia de trabalho"},
        {"id":"duvidas_dificuldades_atitude","label":"Quando você tem alguma dúvida ou dificuldades no trabalho, qual é sua atitude?","leaderLabel":"Quando o(a) colaborador(a) tem alguma dúvida ou dificuldades no trabalho, qual é a atitude?","type":"select","required":true,"active":true,"options":["Resolvo sozinho","Solicito ajuda ao colega","Dirijo-me ao meu supervisor","Nunca peço ajuda"],"leaderOptions":["Resolve sozinho(a)","Solicita ajuda ao colega","Dirige-se a mim, supervisor","Nunca pede ajuda"],"helpText":"Autoavaliação do dia a dia de trabalho"},
        {"id":"duvidas_dificuldades_comente","label":"Comente:","type":"textarea","required":false,"active":true,"helpText":"Autoavaliação do dia a dia de trabalho"},
        {"id":"metodo_empresa","label":"Você está desempenhando seu trabalho conforme o método utilizado pela empresa ou alterou algo?","leaderLabel":"O(a) colaborador(a) está desempenhando o trabalho conforme o método utilizado pela empresa ou alterou algo?","type":"select","required":true,"active":true,"options":["Sigo os padrões da empresa","Sigo os padrões, mas alterei algumas coisas","Trabalho no meu método"],"leaderOptions":["Segue os padrões da empresa","Segue os padrões, mas alterou algumas coisas","Trabalha no seu método"],"helpText":"Autoavaliação do dia a dia de trabalho"},
        {"id":"metodo_empresa_comente","label":"Comente:","type":"textarea","required":false,"active":true,"helpText":"Autoavaliação do dia a dia de trabalho"},
        {"id":"metodo_rendimento","label":"No caso de utilizar em parte, ou completamente seu método, houve maior rendimento?","type":"select","required":false,"active":true,"options":["Sim","Não"],"helpText":"Autoavaliação do dia a dia de trabalho"},
        {"id":"metodo_rendimento_comente","label":"Comente:","type":"textarea","required":false,"active":true,"helpText":"Autoavaliação do dia a dia de trabalho"},
        {"id":"satisfacao_trabalho","label":"Você está satisfeito com o trabalho que executa?","leaderLabel":"Você está satisfeito com o trabalho que o(a) colaborador(a) executa?","type":"select","required":true,"active":true,"options":["Sim","Não"],"helpText":"Satisfação"},
        {"id":"satisfacao_comente","label":"Comente:","type":"textarea","required":false,"active":true,"helpText":"Satisfação"},
        {"id":"observacoes_adicionais","label":"Observações e comentários adicionais:","type":"textarea","required":false,"active":true}
      ]$$::jsonb
    )
)
AS templates(name, period_days, review_type, questions_schema);

INSERT INTO public.performance_review_configs(project_id, name, period_days, review_type, questions_schema, is_active, created_by)
SELECT NULL, name, period_days, review_type, questions_schema, true, NULL
FROM experience_review_question_templates template
WHERE NOT EXISTS (
  SELECT 1
  FROM public.performance_review_configs cfg
  WHERE cfg.project_id IS NULL
    AND cfg.review_type = template.review_type
    AND cfg.period_days = template.period_days
);

UPDATE public.performance_review_configs cfg
SET questions_schema = template.questions_schema,
    name = template.name,
    is_active = true
FROM experience_review_question_templates template
WHERE cfg.project_id IS NULL
  AND cfg.review_type = template.review_type
  AND cfg.period_days = template.period_days;
