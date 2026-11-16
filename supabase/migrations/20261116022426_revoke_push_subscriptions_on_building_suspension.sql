-- Suspending or deleting a building revokes all sessions; revoke its push
-- subscriptions too so a reactivated building cannot notify stale devices.
do $migration$
declare
  v_oid oid;
  v_def text;
  v_old text := '  if p_status <> ''active'' then
    update public.sessions
       set revoked_at = now()
     where building_id = p_building_id
       and revoked_at is null;
  end if;';
  v_new text := '  if p_status <> ''active'' then
    update public.sessions
       set revoked_at = now()
     where building_id = p_building_id
       and revoked_at is null;
    delete from public.push_subscriptions
     where building_id = p_building_id;
  end if;';
begin
  select p.oid into v_oid
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='app_superadmin_set_building_status'
     and pg_get_function_identity_arguments(p.oid)='p_token uuid, p_building_id integer, p_status text';
  if v_oid is null then raise exception 'تابع تغییر وضعیت ساختمان پیدا نشد'; end if;
  v_def:=pg_get_functiondef(v_oid);
  if strpos(v_def,v_old)>0 then
    execute replace(v_def,v_old,v_new);
  elsif strpos(v_def,'delete from public.push_subscriptions')=0 then
    raise exception 'محل حذف اشتراک اعلان ساختمان تعلیق‌شده پیدا نشد';
  end if;
end
$migration$;
