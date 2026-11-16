do $$
declare v text;
begin
  select pg_get_functiondef('public.app_confirm_account_exit(uuid,uuid,text,date,integer,text,text,date,integer)'::regprocedure)
    into v;
  if position('order by a.created_at desc limit 1' in v)=0 then
    raise exception 'Expected account-exit selection order was not found';
  end if;
  v:=replace(v,'order by a.created_at desc limit 1','order by newacc.created_at desc,newacc.id desc limit 1');
  if position('order by newacc.created_at desc,newacc.id desc limit 1' in v)=0 then
    raise exception 'Account-exit ordering patch failed';
  end if;
  execute v;
end
$$;
