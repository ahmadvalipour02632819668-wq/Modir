-- A suspended/deleted building must not regain access through old sessions if reactivated.
-- Superadmin sessions are not building-scoped and remain unaffected.
do $migration$
declare
  v_oid oid;
  v_def text;
  v_old text := 'update public.buildings set status=p_status where id=p_building_id;';
  v_new text := $replacement$update public.buildings set status=p_status where id=p_building_id;
 if p_status <> 'active' then
   update public.sessions
      set revoked_at=now()
    where building_id=p_building_id
      and revoked_at is null;
 end if;$replacement$;
begin
  select p.oid into v_oid
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='app_superadmin_set_building_status'
     and pg_get_function_identity_arguments(p.oid)='p_token uuid, p_building_id integer, p_status text';
  if v_oid is null then raise exception 'تابع تغییر وضعیت ساختمان پیدا نشد'; end if;
  v_def := pg_get_functiondef(v_oid);
  if strpos(v_def,v_old)=0 then raise exception 'محل تغییر وضعیت در تابع پیدا نشد'; end if;
  if length(v_def)-length(replace(v_def,v_old,'')) <> length(v_old) then
    raise exception 'محل تغییر وضعیت در تابع یکتا نیست';
  end if;
  execute replace(v_def,v_old,v_new);
end
$migration$;
