-- Legacy single-account debt report must not select an arbitrary account
-- when the unit has multiple active accounts and no unique primary account.
do $migration$
declare
  v_oid oid;
  v_def text;
  v_new text;
  v_old text;
  v_replacement text;
begin
  select p.oid into v_oid
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='app_get_unit_debts_for_admin'
     and pg_get_function_identity_arguments(p.oid)='p_token uuid, p_unit_no integer, p_today_ym integer';
  if v_oid is null then raise exception 'تابع گزارش بدهی واحد پیدا نشد'; end if;
  v_def := pg_get_functiondef(v_oid);

  v_old := 'declare me public.accounts; target public.accounts; cur int; stop_ym int; d record; paid bigint; pending_paid bigint; rem bigint; out_rows jsonb:=''[]''::jsonb; cats text[]:=array[''charge'',''water'',''gas'',''repair'',''parking'']; c text; amount_due bigint;';
  v_replacement := v_old || E'\n' || ' v_active_count integer := 0; v_primary_count integer := 0;';
  if strpos(v_def,v_old)=0 then raise exception 'تعریف متغیرهای گزارش پیدا نشد'; end if;
  v_new := replace(v_def,v_old,v_replacement);

  v_old := $old$ select * into target from public.accounts a where a.building_id=me.building_id and a.unit_no=p_unit_no and a.is_active order by a.is_primary desc limit 1;$old$;
  v_replacement := $new$ select count(*),count(*) filter(where a.is_primary)
   into v_active_count,v_primary_count
   from public.accounts a
   where a.building_id=me.building_id and a.unit_no=p_unit_no and a.is_active;
 if v_active_count>1 and v_primary_count<>1 then
   raise exception 'حساب اصلی این واحد مشخص نیست؛ گزارش تک‌حسابی قابل محاسبه نیست';
 end if;
 select * into target from public.accounts a
  where a.building_id=me.building_id and a.unit_no=p_unit_no and a.is_active
  order by a.is_primary desc,a.created_at,a.id limit 1;$new$;
  if strpos(v_new,v_old)=0 then raise exception 'انتخاب حساب در گزارش پیدا نشد'; end if;
  v_new := replace(v_new,v_old,v_replacement);
  execute v_new;
end
$migration$;
