-- Modelo global de Descrição de Cargo baseado na aba "DC" do template legado.
-- Campos globais antigos são desativados; os campos dos projetos vinculados a
-- eles acompanham a alteração pelos gatilhos já existentes.
WITH template(field_key, label, section, field_type, required, ord) AS (
  VALUES
    ('cargo','Nomenclatura do Cargo Visível','Cabecalho','text',true,10),
    ('data_versao','Data de Criação do Cargo','Cabecalho','date',false,20),
    ('data_revisao','Data Última Revisão do Cargo','Cabecalho','date',false,30),
    ('tipo_carreira','Tipo de Carreira do Cargo','Cabecalho','text',false,40),
    ('area_setor','Área/Setor do Cargo','Cabecalho','text',false,50),
    ('superior_imediato','Cargo do Superior Imediato','Cabecalho','text',false,60),
    ('adicional','Algum adicional?','Cabecalho','text',false,70),
    ('disponibilidade_viagens','Disponibilidade para Viagens?','Cabecalho','text',false,80),
    ('veiculo_proprio','Necessita veículo próprio?','Cabecalho','text',false,90),
    ('cnh','Carteira Nacional de Habilitação?','Cabecalho','text',false,100),
    ('objetivo','Objetivo Principal do Cargo','Cabecalho','textarea',false,110),
    ('requisito_instrucao','Requisito de Instrução','Instrucao','text',false,120),
    ('nivel_instrucao','Nível da Instrução','Instrucao','text',false,130),
    ('area_instrucao','Área da Instrução','Instrucao','text',false,140),
    ('requisito_experiencia','Requisito da Experiência','Experiencia','text',false,150),
    ('tempo_minimo','Tempo mínimo necessário','Experiencia','number',false,160),
    ('unidade_tempo','Meses ou ano','Experiencia','text',false,170),
    ('tipo_experiencia','Que tipo de experiência?','Experiencia','text',false,180),
    ('area_experiencia','Área de experiência','Experiencia','text',false,190),
    ('requisito_conhecimento','Qual o requisito deste conhecimento?','Conhecimento','text',false,200),
    ('conhecimento_tecnico','Qual o conhecimento técnico?','Conhecimento','text',false,210),
    ('nivel_conhecimento','Qual o nível de conhecimento?','Conhecimento','text',false,220),
    ('atividade_principal','Atividade Principal?','Atividades','text',false,230),
    ('atividade','Atividade','Atividades','textarea',false,240),
    ('periodicidade','Periodicidade','Atividades','text',false,250),
    ('atividade_referenciada','Atividade Referenciada','Indicadores','text',false,260),
    ('nomenclatura_indicador','Nomenclatura do Indicador','Indicadores','text',false,270),
    ('fonte_coleta_dados','Fonte de Coleta de Dados','Indicadores','text',false,280),
    ('forma_calculo','Forma de Cálculo','Indicadores','text',false,290),
    ('unidade_medida','Unidade a ser medida','Indicadores','text',false,300),
    ('meta','Meta','Indicadores','text',false,310),
    ('resultado','Resultado','Indicadores','text',false,320),
    ('percentual_alcance','% de Alcance','Indicadores','text',false,330),
    ('habilidade_cultural','Habilidades da Cultura Organizacional','Habilidades Culturais','text',false,340),
    ('habilidade_cargo','Habilidades Específicas do Cargo','Habilidades do Cargo','text',false,350),
    ('postura_comportamento','Postura e Comportamento','Postura & Comportamento','text',false,360)
), upserted AS (
  INSERT INTO public.base_fields(project_id, field_key, label, section, field_type, is_required, display_order, allows_multiple, allows_free_text, data_source, is_active)
  SELECT null, field_key, label, section, field_type::public.dynamic_field_type, required, ord, false, true, 'manual', true
  FROM template
  ON CONFLICT (field_key) WHERE project_id IS NULL DO UPDATE
  SET label = excluded.label, section = excluded.section, field_type = excluded.field_type,
      is_required = excluded.is_required, display_order = excluded.display_order,
      allows_free_text = excluded.allows_free_text, is_active = true
  RETURNING field_key
)
UPDATE public.base_fields
SET is_active = false
WHERE project_id IS NULL
  AND field_key NOT IN (SELECT field_key FROM upserted);

INSERT INTO public.base_section_settings(project_id, section, max_items, is_enabled)
VALUES
  (null,'Instrucao',20,true), (null,'Experiencia',20,true), (null,'Conhecimento',30,true),
  (null,'Atividades',100,true), (null,'Indicadores',50,true), (null,'Habilidades do Cargo',50,true),
  (null,'Habilidades Culturais',50,true), (null,'Postura & Comportamento',50,true)
ON CONFLICT (section) WHERE project_id IS NULL
DO UPDATE SET max_items = excluded.max_items, is_enabled = true;
