create or replace function public.app_admin_review_payment(
  p_token uuid,
  p_id bigint,
  p_approve boolean,
  p_amount bigint default null,
  p_admin_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  me public.accounts;
  pr public.payment_requests;
  occ text;
  final_amount bigint;
  existing_tx public.transactions;
  v_admin_note text := nullif(btrim(coalesce(p_admin_note,'')),'');
begin
  me := public.bm_admin(p_token);

  if length(coalesce(v_admin_note,'')) > 1000 then
    raise exception 'توضیحات مدیر بیش از حد مجاز است';
  end if;

  select * into pr
    from public.payment_requests
   where id=p_id and building_id=me.building_id
   for update;

  if not found then
    raise exception 'درخواست پرداخت یافت نشد یا متعلق به این ساختمان نیست';
  end if;

  if pr.status <> 'pending' then
    raise exception 'این درخواست قبلاً بررسی شده است';
  end if;

  if p_approve and exists (
    select 1 from public.payment_requests other
     where other.building_id=pr.building_id
       and other.account_id=pr.account_id
       and other.year=pr.year and other.month=pr.month
       and other.category=pr.category
       and other.status='pending' and other.id<>pr.id
  ) then
    raise exception 'درخواست تکراریِ در انتظار بررسی وجود دارد؛ ابتدا درخواست‌های تکراری را تعیین تکلیف کنید';
  end if;

  if p_approve then
    final_amount := coalesce(p_amount,pr.amount);
    if final_amount is null or final_amount<=0 then
      raise exception 'مبلغ پرداخت معتبر نیست';
    end if;

    select a.occupancy into occ
      from public.accounts a
     where a.id=pr.account_id and a.building_id=me.building_id;

    if not found or occ is null then
      raise exception 'حساب پرداخت‌کننده معتبر نیست';
    end if;

    select * into existing_tx
      from public.transactions
     where payment_request_id=pr.id
     for update;

    if found then
      if existing_tx.building_id is distinct from me.building_id
         or existing_tx.account_id is distinct from pr.account_id
         or existing_tx.year is distinct from pr.year
         or existing_tx.month is distinct from pr.month
         or existing_tx.unit_no is distinct from pr.unit_no
         or existing_tx.category is distinct from pr.category
         or existing_tx.amount is distinct from final_amount
         or existing_tx.tx_type is distinct from 'درآمد'
         or existing_tx.source is distinct from 'payment' then
        raise exception 'تراکنش مرتبط با درخواست پرداخت با اطلاعات درخواست مطابقت ندارد؛ تأیید متوقف شد';
      end if;
    else
      insert into public.transactions (
        building_id,year,month,unit_no,account_id,tx_type,category,description,
        amount,occupancy,source,payment_request_id,created_by,
        pay_date,ref_code,note,receipt_image
      ) values (
        me.building_id,pr.year,pr.month,pr.unit_no,pr.account_id,'درآمد',pr.category,
        'تایید پرداخت: '||coalesce(pr.note,''),
        final_amount,occ,'payment',pr.id,me.id,
        pr.pay_date,pr.ref_code,pr.note,pr.receipt_image
      );
    end if;

    update public.payment_requests
       set status='approved',
           amount=final_amount,
           reviewed_by=me.id,
           reviewed_at=now(),
           admin_note=v_admin_note
     where id=p_id and building_id=me.building_id and status='pending';

    if not found then raise exception 'وضعیت درخواست همزمان تغییر کرده است'; end if;
  else
    if exists(select 1 from public.transactions where payment_request_id=pr.id) then
      raise exception 'برای این درخواست قبلاً تراکنش ثبت شده است؛ امکان رد کردن آن وجود ندارد';
    end if;

    update public.payment_requests
       set status='rejected',reviewed_by=me.id,reviewed_at=now(),admin_note=v_admin_note
     where id=p_id and building_id=me.building_id and status='pending';

    if not found then raise exception 'وضعیت درخواست همزمان تغییر کرده است'; end if;
  end if;
end;
$function$;

revoke all on function public.app_admin_review_payment(uuid,bigint,boolean,bigint,text) from public;
revoke all on function public.app_admin_review_payment(uuid,bigint,boolean,bigint,text) from authenticated;
grant execute on function public.app_admin_review_payment(uuid,bigint,boolean,bigint,text) to anon;

do $migration$
begin
  if not exists (select 1 from pg_constraint where conrelid='public.payment_requests'::regclass and conname='payment_requests_admin_note_length') then
    alter table public.payment_requests add constraint payment_requests_admin_note_length
      check (admin_note is null or length(admin_note) <= 1000);
  end if;
end
$migration$;
