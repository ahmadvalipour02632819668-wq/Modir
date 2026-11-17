
create or replace function public.app_recurring_finalize_run(p_run_id uuid,p_auto boolean,p_actor uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r record; o record; ver record; exp_id uuid; total_i numeric; item_count integer; method_i text;
begin
 select * into r from public.recurring_obligation_runs where id=p_run_id for update;
 if not found then raise exception 'پیش‌نویس پیدا نشد'; end if;
 if r.status in ('approved','auto_approved') then return jsonb_build_object('success',true,'already_finalized',true,'expense_id',r.expense_id); end if;
 if r.status<>'draft' then raise exception 'این پیش‌نویس قابل ثبت نیست'; end if;
 if p_auto and now()<r.review_deadline then raise exception 'مهلت بررسی مدیر هنوز تمام نشده است'; end if;
 select * into o from public.recurring_obligations where id=r.obligation_id;
 select * into ver from public.recurring_obligation_versions where obligation_id=r.obligation_id and effective_from<=r.period_start order by effective_from desc limit 1;
 if not found then raise exception 'نسخه نرخ این دوره پیدا نشد'; end if;
 select coalesce(sum(amount),0),count(*) into total_i,item_count from public.recurring_obligation_items where run_id=r.id;
 if item_count=0 or total_i<=0 then raise exception 'پیش‌نویس فاقد ردیف قابل ثبت است'; end if;
 method_i:=case ver.calculation_method
  when 'per_unit' then 'dynamic_per_unit'
  when 'per_meter' then 'dynamic_per_meter'
  when 'per_resident' then 'dynamic_per_resident'
  when 'total_equal' then 'equal' end;
 insert into public.building_expenses(building_id,description,amount,input_amount,expense_date,allocation_method,tx_type,category,expense_status,created_by,payer_roles,period_start,period_end,selected_unit_ids)
 values(r.building_id,o.title||' - '||to_char(r.period_start,'YYYY-MM'),total_i,ver.amount,r.period_start,method_i,'مطالبه',o.category,'active',
  coalesce(p_actor,o.created_by),ver.payer_roles,r.period_start,r.period_end,ver.selected_unit_ids)
 returning id into exp_id;
 insert into public.building_expense_allocations(building_id,expense_id,membership_id,amount)
 select r.building_id,exp_id,i.membership_id,i.amount from public.recurring_obligation_items i where i.run_id=r.id;
 update public.recurring_obligation_runs set status=case when p_auto then 'auto_approved' else 'approved' end,
  approved_at=now(),approved_by=p_actor,expense_id=exp_id where id=r.id;
 return jsonb_build_object('success',true,'expense_id',exp_id,'item_count',item_count,'total_amount',total_i);
end $$;

