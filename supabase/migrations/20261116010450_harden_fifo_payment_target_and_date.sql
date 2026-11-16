create or replace function public.app_process_payment_fifo(
  p_token uuid,
  p_total_amount bigint,
  p_pay_date text,
  p_ref_code text,
  p_note text,
  p_receipt_image text,
  p_target_unit integer default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  me public.accounts;
  target public.accounts;
  un integer;
  cur integer;
  stop_ym integer;
  d record;
  paid bigint;
  pending_paid bigint;
  due bigint;
  remain bigint := p_total_amount;
  chunk bigint;
  c text;
  cats text[] := ARRAY['charge','water','gas','repair','parking'];
  inserted integer := 0;
  e record;
  active_count integer := 0;
  primary_count integer := 0;
begin
  me := public.bm_auth(p_token);

  if p_total_amount is null or p_total_amount <= 0 then
    return jsonb_build_object('ok',false,'error','مبلغ نامعتبر است');
  end if;

  if p_pay_date is null
     or p_pay_date !~ '^[0-9]{4}/(0?[1-9]|1[0-2])/(0?[1-9]|[12][0-9]|3[01])$' then
    return jsonb_build_object('ok',false,'error','تاریخ پرداخت معتبر نیست؛ تاریخ را از تقویم انتخاب کنید');
  end if;

  if p_ref_code is not null and length(p_ref_code)>120 then
    return jsonb_build_object('ok',false,'error','کد پیگیری بیش از حد طولانی است');
  end if;
  if p_note is not null and length(p_note)>1000 then
    return jsonb_build_object('ok',false,'error','توضیحات بیش از حد طولانی است');
  end if;
  if p_receipt_image is not null and (
       length(p_receipt_image)>1200000
       or p_receipt_image !~ '^data:image/jpeg;base64,[A-Za-z0-9+/]+={0,2}$'
     ) then
    return jsonb_build_object('ok',false,'error','تصویر فیش باید JPEG معتبر و حداکثر ۱٫۲ مگابایت باشد');
  end if;

  stop_ym := split_part(p_pay_date,'/',1)::integer * 100
           + split_part(p_pay_date,'/',2)::integer;

  if me.is_admin and p_target_unit is not null then
    un := p_target_unit;

    select count(*) filter(where a.is_active),
           count(*) filter(where a.is_active and a.is_primary)
      into active_count,primary_count
      from public.accounts a
     where a.building_id=me.building_id
       and a.unit_no=un;

    if active_count=0 then
      return jsonb_build_object('ok',false,'error','برای این واحد حساب فعال پیدا نشد');
    elsif active_count=1 then
      select * into target
        from public.accounts a
       where a.building_id=me.building_id
         and a.unit_no=un
         and a.is_active
       for update;
    elsif primary_count=1 then
      select * into target
        from public.accounts a
       where a.building_id=me.building_id
         and a.unit_no=un
         and a.is_active
         and a.is_primary
       limit 1
       for update;
    else
      return jsonb_build_object('ok',false,'error','این واحد چند حساب فعال دارد و حساب اصلی آن مشخص نیست؛ ابتدا حساب موردنظر را تعیین کنید');
    end if;
  else
    target := me;
    un := me.unit_no;
    select * into target
      from public.accounts a
     where a.id=me.id
       and a.building_id=me.building_id
       and a.is_active
     for update;
  end if;

  if un is null then
    return jsonb_build_object('ok',false,'error','کاربر واحد ندارد');
  end if;
  if target.id is null then
    return jsonb_build_object('ok',false,'error','حساب پرداخت‌کننده معتبر نیست');
  end if;

  cur := coalesce(target.start_ym,140406);

  while cur <= stop_ym and remain > 0 loop
    select * into d
      from public.bm2_account_month_due(me.building_id,target.id,cur);

    foreach c in array cats loop
      exit when remain <= 0;

      due := case c
        when 'charge' then coalesce(d.charge,0)
        when 'water' then coalesce(d.water,0)
        when 'gas' then coalesce(d.gas,0)
        when 'repair' then coalesce(d.repair,0)
        else coalesce(d.parking,0)
      end;

      select coalesce(sum(t.amount),0)
        into paid
        from public.transactions t
       where t.building_id=me.building_id
         and t.unit_no=un
         and t.tx_type='درآمد'
         and (t.account_id=target.id or (t.account_id is null and t.occupancy=target.occupancy))
         and t.ym=cur
         and t.category=c;

      select coalesce(sum(pr.amount),0)
        into pending_paid
        from public.payment_requests pr
       where pr.building_id=me.building_id
         and pr.account_id=target.id
         and pr.unit_no=un
         and pr.year=cur/100
         and pr.month=cur%100
         and pr.category=c
         and pr.status='pending';

      due := greatest(due-paid-pending_paid,0);

      if due>0 then
        chunk := least(due,remain);
        insert into public.payment_requests(
          building_id,account_id,unit_no,year,month,category,amount,
          pay_date,ref_code,note,receipt_image,status
        )
        values(
          me.building_id,target.id,un,cur/100,cur%100,c,chunk,
          p_pay_date,p_ref_code,p_note,p_receipt_image,'pending'
        );
        remain := remain-chunk;
        inserted := inserted+1;
      end if;
    end loop;

    for e in
      select t.id,t.year,t.month,t.description,
             (sh->>'amount')::bigint as share_amount
        from public.transactions t
        cross join lateral jsonb_array_elements(coalesce(t.expense_shares,'[]'::jsonb)) sh
       where t.building_id=me.building_id
         and t.tx_type='هزینه'
         and t.year*100+t.month=cur
         and sh->>'account_id'=target.id::text
       order by t.id
    loop
      exit when remain<=0;

      select coalesce(sum(x.amount),0) into paid
        from public.transactions x
       where x.building_id=me.building_id
         and x.unit_no=un
         and x.account_id=target.id
         and x.tx_type='درآمد'
         and x.category='expense:'||e.id::text
         and x.year=e.year
         and x.month=e.month;

      select coalesce(sum(pr.amount),0) into pending_paid
        from public.payment_requests pr
       where pr.building_id=me.building_id
         and pr.account_id=target.id
         and pr.unit_no=un
         and pr.year=e.year
         and pr.month=e.month
         and pr.category='expense:'||e.id::text
         and pr.status='pending';

      due:=greatest(e.share_amount-paid-pending_paid,0);

      if due>0 then
        chunk:=least(due,remain);
        insert into public.payment_requests(
          building_id,account_id,unit_no,year,month,category,amount,
          pay_date,ref_code,note,receipt_image,status
        )
        values(
          me.building_id,target.id,un,e.year,e.month,'expense:'||e.id::text,
          chunk,p_pay_date,p_ref_code,
          coalesce(p_note,'')||' (پرداخت هزینه: '||coalesce(e.description,'هزینه تسهیمی')||')',
          p_receipt_image,'pending'
        );
        remain:=remain-chunk;
        inserted:=inserted+1;
      end if;
    end loop;

    cur:=public.bm_next_ym(cur);
  end loop;

  if remain>0 then
    insert into public.payment_requests(
      building_id,account_id,unit_no,year,month,category,amount,
      pay_date,ref_code,note,receipt_image,status
    )
    values(
      me.building_id,target.id,un,stop_ym/100,stop_ym%100,'charge',remain,
      p_pay_date,p_ref_code,coalesce(p_note,'')||' (بستانکاری)',
      p_receipt_image,'pending'
    );
    inserted:=inserted+1;
  end if;

  return jsonb_build_object('ok',true,'inserted_count',inserted,'remaining_money',0);
end;
$function$;
