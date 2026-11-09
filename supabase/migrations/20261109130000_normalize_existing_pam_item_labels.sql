-- Normaliza todos os itens de PAM existentes para a estrutura visual:
-- tipo do bloco, pergunta e status. Respostas e andamento do PAM sao preservados.

with review_item_context as (
  select
    pam.id as pam_id,
    question.value ->> 'id' as question_id,
    question.value ->> 'dynamicSource' as dynamic_source,
    score_context.context_label
  from public.pam as pam
  join public.performance_reviews as review on review.id = pam.review_id
  cross join lateral jsonb_array_elements(
    case
      when jsonb_typeof(review.questions_snapshot) = 'array' then review.questions_snapshot
      else '[]'::jsonb
    end
  ) as question(value)
  left join lateral (
    select nullif(trim(score_item.value ->> 'contextLabel'), '') as context_label
    from jsonb_array_elements(
      case
        when jsonb_typeof(review.score_summary_snapshot -> 'blocks') = 'array'
          then review.score_summary_snapshot -> 'blocks'
        else '[]'::jsonb
      end
    ) as score_block(value)
    cross join lateral jsonb_array_elements(
      case
        when jsonb_typeof(score_block.value -> 'items') = 'array'
          then score_block.value -> 'items'
        else '[]'::jsonb
      end
    ) as score_item(value)
    where score_item.value ->> 'id' = question.value ->> 'id'
    limit 1
  ) as score_context on true
)
update public.pam_items as item
set
  category_label = case review_item.dynamic_source
    when 'activities' then 'Atividade'
    when 'indicators' then 'Indicador'
    when 'culture_skills' then 'Habilidade Cultural'
    when 'role_skills' then 'Habilidade do Cargo'
    when 'behavior' then 'Postura e Comportamento'
    else coalesce(nullif(trim(item.category_label), ''), 'Bloco')
  end,
  improvement_point = coalesce(
    review_item.context_label,
    item.improvement_point
  ),
  skill_label = null
from review_item_context as review_item
where review_item.pam_id = item.pam_id
  and review_item.question_id = item.source_key;

-- Itens antigos sem correspondencia no snapshot ainda deixam de repetir
-- pergunta/titulo nos campos auxiliares.
update public.pam_items
set
  skill_label = null
where source = 'performance_review';
