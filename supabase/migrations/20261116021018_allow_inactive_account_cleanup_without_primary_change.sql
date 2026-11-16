-- Only enforce the primary invariant when the account being deleted is active.
-- Removing an already-inactive archived account must not be blocked by unrelated
-- legacy primary-account issues in the unit.
do $migration$
declare
  v_oid oid;
  v_def text;
  v_old text := '  if v_remaining_count > 0 and v_remaining_primary_count <> 1 then';
  v_new text := '  if target.is_active and v_remaining_count > 0 and v_remaining_primary_count <> 1 then';
begin
  select p.oid into v_oid
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='app_admin_delete_account'
     and pg_get_function_identity_arguments(p.oid)='p_token uuid, p_id uuid';
  if v_oid is null then raise exception 'تابع حذف حساب پیدا نشد'; end if;
  v_def:=pg_get_functiondef(v_oid);
  if strpos(v_def,v_old)=0 then raise exception 'محل محافظ حساب اصلی پیدا نشد'; end if;
  execute replace(v_def,v_old,v_new);
end
$migration$;
