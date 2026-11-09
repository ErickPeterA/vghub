-- A data exibida como "Feedback" no PAM é sempre a data em que a GP
-- finalizou a avaliação, após registrar o parecer.

update public.pam as pam
   set feedback_date = (review.finalized_at at time zone 'America/Sao_Paulo')::date
  from public.performance_reviews as review
 where review.id = pam.review_id
   and review.finalized_at is not null
   and pam.feedback_date is distinct from
       (review.finalized_at at time zone 'America/Sao_Paulo')::date;

create or replace function public.sync_pam_feedback_date_from_review()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'finalized' and new.finalized_at is not null then
    update public.pam
       set feedback_date = (new.finalized_at at time zone 'America/Sao_Paulo')::date
     where review_id = new.id
       and feedback_date is distinct from
           (new.finalized_at at time zone 'America/Sao_Paulo')::date;
  end if;

  return new;
end;
$$;

drop trigger if exists sync_pam_feedback_date_from_review
  on public.performance_reviews;

drop trigger if exists trg_performance_reviews_sync_pam_feedback_date
  on public.performance_reviews;

-- O prefixo mantem este trigger depois de trg_performance_reviews_create_pam,
-- garantindo que o PAM recém-criado tambem seja sincronizado.
create trigger trg_performance_reviews_sync_pam_feedback_date
after insert or update of status, finalized_at
on public.performance_reviews
for each row
execute function public.sync_pam_feedback_date_from_review();
