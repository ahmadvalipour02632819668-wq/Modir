-- A poll is single-choice and a vote cannot be changed after submission.
create or replace function public.app_vote_poll(
  p_token uuid,
  p_poll_id bigint,
  p_option_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  me public.accounts;
begin
  me := public.bm_auth(p_token);

  if not exists (
    select 1
    from public.building_polls p
    join public.building_poll_options o on o.poll_id = p.id
    where p.id = p_poll_id
      and p.building_id = me.building_id
      and p.is_active
      and o.id = p_option_id
  ) then
    raise exception 'گزینه نظرسنجی معتبر نیست';
  end if;

  insert into public.building_poll_votes(poll_id, option_id, account_id)
  values (p_poll_id, p_option_id, me.id)
  on conflict (poll_id, account_id) do nothing;

  if not found then
    raise exception 'قبلاً در این نظرسنجی رأی ثبت کرده‌اید';
  end if;

  return jsonb_build_object('ok', true);
end
$function$;
