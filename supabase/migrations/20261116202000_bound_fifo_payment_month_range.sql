-- Bound FIFO payment processing to valid Jalali years/months and at most 240 months.
-- This prevents a forged payment date from creating an unbounded monthly loop.
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
   where n.nspname='public' and p.proname='app_process_payment_fifo'
     and pg_get_function_identity_arguments(p.oid)='p_token uuid, p_total_amount bigint, p_pay_date text, p_ref_code text, p_note text, p_receipt_image text, p_target_unit integer';
  if v_oid is null then raise exception 'تابع پرداخت FIFO پیدا نشد'; end if;
  v_def := pg_get_functiondef(v_oid);
  v_old := '  cur := coalesce(target.start_ym,140406);';
  v_replacement := $new$  cur := coalesce(target.start_ym,140406);
  if stop_ym / 100 not between 1300 and 1600
     or stop_ym % 100 not between 1 and 12
     or cur / 100 not between 1300 and 1600
     or cur % 100 not between 1 and 12 then
    return jsonb_build_object('ok',false,'error','بازه تاریخ پرداخت یا شروع محاسبات معتبر نیست');
  end if;
  if stop_ym >= cur
     and ((stop_ym / 100) * 12 + (stop_ym % 100))
         - ((cur / 100) * 12 + (cur % 100)) > 240 then
    return jsonb_build_object('ok',false,'error','بازه پرداخت نمی‌تواند بیش از ۲۴۰ ماه باشد');
  end if;$new$;
  if strpos(v_def,v_old)=0 then raise exception 'محل کنترل بازه در پرداخت FIFO پیدا نشد'; end if;
  v_new := replace(v_def,v_old,v_replacement);
  execute v_new;
end
$migration$;
