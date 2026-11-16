-- SQL three-valued logic treats NULL NOT IN (...) as NULL, not true.
-- Explicitly reject NULL decisions so a missing decision cannot approve a request
-- or fall through to the payment rejection branch.
do $migration$
declare
  r record;
  v_def text;
  v_old text := 'if p_decision not in (''approve'',''reject'') then';
  v_new text := 'if p_decision is null or p_decision not in (''approve'',''reject'') then';
  v_old_pay text := 'me := public.bm_admin(p_token);';
  v_new_pay text := 'me := public.bm_admin(p_token);
  if p_approve is null then
    raise exception ''تصمیم بررسی پرداخت معتبر نیست'';
  end if;';
begin
  for r in
    select p.oid,p.proname
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public'
       and p.proname in ('app_admin_review_membership_registration','app_superadmin_review_registration')
       and p.prokind='f'
  loop
    v_def:=pg_get_functiondef(r.oid);
    if strpos(v_def,v_old)=0 then
      if strpos(v_def,v_new)=0 then
        raise exception 'محل بررسی تصمیم در تابع % پیدا نشد',r.proname;
      end if;
    else
      v_def:=replace(v_def,v_old,v_new);
      execute v_def;
    end if;
  end loop;

  select p.oid into r
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='app_admin_review_payment'
     and pg_get_function_identity_arguments(p.oid)='p_token uuid, p_id bigint, p_approve boolean, p_amount bigint, p_admin_note text';
  if r.oid is null then raise exception 'تابع بررسی پرداخت پیدا نشد'; end if;
  v_def:=pg_get_functiondef(r.oid);
  if strpos(v_def,'p_approve is null')=0 then
    if strpos(v_def,v_old_pay)=0 then raise exception 'محل اعتبارسنجی تصمیم پرداخت پیدا نشد'; end if;
    execute replace(v_def,v_old_pay,v_new_pay);
  end if;
end
$migration$;
