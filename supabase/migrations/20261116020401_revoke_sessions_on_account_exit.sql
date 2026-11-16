-- Immediately revoke all sessions when an account exit is confirmed.
do $migration$
declare
  v_oid oid;
  v_def text;
  v_old text := '  update public.accounts
     set is_active=false,is_primary=false,username=v_username,
         exit_date_jalali=p_exit_date_jalali,exit_date=p_exit_date,updated_at=now()
   where id=a.id and building_id=me.building_id;';
  v_new text := '  update public.accounts
     set is_active=false,is_primary=false,username=v_username,
         exit_date_jalali=p_exit_date_jalali,exit_date=p_exit_date,updated_at=now()
   where id=a.id and building_id=me.building_id;

  update public.sessions
     set revoked_at=now()
   where account_id=a.id
     and building_id=me.building_id
     and revoked_at is null;';
begin
  select p.oid into v_oid
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='app_confirm_account_exit'
     and pg_get_function_identity_arguments(p.oid)='p_token uuid, p_account_id uuid, p_exit_date_jalali text, p_exit_date date, p_month_days integer, p_next_occupancy text, p_next_start_date_jalali text, p_next_start_date date, p_next_persons integer';
  if v_oid is null then raise exception 'تابع تسویه خروج پیدا نشد'; end if;
  v_def:=pg_get_functiondef(v_oid);
  if strpos(v_def,v_old)=0 then raise exception 'محل غیرفعال‌سازی حساب خروجی پیدا نشد'; end if;
  execute replace(v_def,v_old,v_new);
end
$migration$;
