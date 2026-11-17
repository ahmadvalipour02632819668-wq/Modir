
create or replace function public.app_admin_register_opening_balance(
  p_token uuid,p_account_id uuid,p_balance_type text,p_amount bigint,
  p_year integer,p_month integer,p_day integer,p_note text default null
) returns jsonb
language plpgsql security definer set search_path to 'public'
as $function$
declare me public.accounts; a public.accounts; v_type text; v_category text; v_amount bigint; v_desc text; v_tx public.transactions;
begin
  me:=public.bm_admin(p_token);
  if p_balance_type is null or p_balance_type not in ('debit','credit') then raise exception 'نوع مانده اولیه معتبر نیست'; end if;
  if p_account_id is null then raise exception 'حساب را انتخاب کنید'; end if;
  if coalesce(p_amount,0)<=0 then raise exception 'مبلغ باید بیشتر از صفر باشد'; end if;
  if p_year is null or p_year not between 1300 and 1600 or p_month is null or p_month not between 1 and 12 or p_day is null or p_day not between 1 and 31 then
    raise exception 'تاریخ مانده اولیه معتبر نیست';
  end if;
  select * into a from public.accounts where id=p_account_id and building_id=me.building_id for update;
  if not found then raise exception 'حساب انتخاب‌شده متعلق به این ساختمان نیست'; end if;
  if exists(select 1 from public.transactions where building_id=me.building_id and account_id=a.id and source='opening_balance') then
    raise exception 'برای این حساب قبلاً مانده اولیه ثبت شده است؛ برای اصلاح، با پشتیبانی تماس بگیرید';
  end if;
  if p_balance_type='debit' then
    v_type:='انتقال مانده مالک'; v_category:='owner_balance_transfer_debt'; v_amount:=-p_amount;
    v_desc:='ثبت بدهی پیشین حساب'||case when nullif(btrim(p_note),'') is not null then ' - '||btrim(p_note) else '' end;
  else
    v_type:='انتقال بستانکاری'; v_category:='opening_balance_credit'; v_amount:=p_amount;
    v_desc:='ثبت بستانکاری پیشین حساب'||case when nullif(btrim(p_note),'') is not null then ' - '||btrim(p_note) else '' end;
  end if;
  insert into public.transactions(tx_date,year,month,day,ym,month_name,unit_no,tx_type,description,amount,occupancy,category,source,created_by,building_id,account_id)
  values(p_year::text||'/'||lpad(p_month::text,2,'0')||'/'||lpad(p_day::text,2,'0'),p_year,p_month,p_day,p_year*100+p_month,
    public.bm_month_name(p_month),a.unit_no,v_type,v_desc,v_amount,a.occupancy,v_category,'opening_balance',me.id,me.building_id,a.id)
  returning * into v_tx;
  return jsonb_build_object('ok',true,'transaction_id',v_tx.id,'amount',p_amount,'balance_type',p_balance_type);
end;
$function$;

