-- Prevent expense allocation from silently choosing an arbitrary active account.
-- If a unit has multiple eligible active accounts, exactly one must be primary.
do $migration$
declare
  v_sig regprocedure;
  v_def text;
  v_marker text := E'  if exists(\n    select 1 from public.transactions x';
  v_guard text := E'  if p_expense_scope=''unit'' then\n    if (select count(*) from public.accounts a\n        where a.building_id=me.building_id and a.unit_no=v_unit\n          and a.is_active and a.occupancy=any(p_payer_occupancies)) > 1\n       and (select count(*) from public.accounts a\n            where a.building_id=me.building_id and a.unit_no=v_unit\n              and a.is_active and a.is_primary\n              and a.occupancy=any(p_payer_occupancies)) <> 1 then\n      raise exception ''برای این واحد چند حساب مسئول پرداخت فعال وجود دارد و حساب اصلی یکتا نیست؛ ابتدا حساب اصلی را در تنظیمات واحد مشخص کنید'';\n    end if;\n  elsif p_expense_scope=''building'' and p_expense_kind=''shared'' then\n    if exists (\n      select 1 from public.units u\n      join lateral (\n        select count(*) as candidate_count, count(*) filter (where a.is_primary) as primary_count\n        from public.accounts a\n        where a.building_id=u.building_id and a.unit_no=u.unit_no\n          and a.is_active and a.occupancy=any(p_payer_occupancies)\n      ) c on true\n      where u.building_id=me.building_id\n        and not (u.unit_no=any(coalesce(p_excluded_units,''{}''::integer[])))\n        and c.candidate_count > 1 and c.primary_count <> 1\n    ) then\n      raise exception ''حداقل یک واحد چند حساب مسئول پرداخت فعال دارد و حساب اصلی یکتایی ندارد؛ ابتدا حساب‌های اصلی واحدها را مشخص کنید'';\n    end if;\n  end if;\n\n';
begin
  foreach v_sig in array array[
    'public.app_admin_save_expense(uuid,bigint,integer,integer,integer,integer,text,text,text,bigint,text,text,text,text[],integer[],date,date)'::regprocedure,
    'public.app_admin_save_expense(uuid,bigint,integer,integer,integer,integer,text,text,text,bigint,text,text,text,text[],integer[])'::regprocedure
  ] loop
    select pg_get_functiondef(v_sig::oid) into v_def;
    if position(v_marker in v_def)=0 then
      raise exception 'Expected insertion point not found in %', v_sig;
    end if;
    if position('حساب اصلی یکتا نیست' in v_def)>0 then
      continue;
    end if;
    v_def := replace(v_def, v_marker, v_guard || v_marker);
    execute v_def;
  end loop;
end
$migration$;
