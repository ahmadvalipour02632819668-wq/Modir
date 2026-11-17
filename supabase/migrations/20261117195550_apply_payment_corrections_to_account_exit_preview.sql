-- Keep account-exit previews consistent with corrected payment transactions.
-- Original transactions remain immutable; their correction amounts are deducted
-- from the payment totals used to calculate the final settlement balance.
do $migration$
declare
  v_oid oid;
  v_def text;
  v_new text;
  v_old text := 'sum(t.amount)';
  v_replacement text := 'sum(t.amount - coalesce((select sum(pc.amount) from public.payment_corrections pc where pc.original_transaction_id=t.id),0))';
  v_count integer;
begin
  select 'public.app_preview_account_exit(uuid,uuid,text,date,integer,text,text,date,integer)'::regprocedure::oid
    into v_oid;
  v_def := pg_get_functiondef(v_oid);
  v_count := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_count <> 3 then
    raise exception 'Expected 3 payment amount aggregates in app_preview_account_exit; found %', v_count;
  end if;
  v_new := replace(v_def, v_old, v_replacement);
  if position('public.payment_corrections' in v_new) = 0
     or position(v_old in v_new) > 0 then
    raise exception 'Payment correction integration patch verification failed';
  end if;
  execute v_new;
end
$migration$;
