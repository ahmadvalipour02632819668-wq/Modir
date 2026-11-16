do $$
declare v text;
begin
  select pg_get_functiondef('public.app_admin_create_account(uuid,integer,text,text,text,text,text,text,numeric,integer,text)'::regprocedure)
    into v;
  v:=replace(v,'p_username !~','coalesce(p_username,'''') !~');
  v:=replace(v,'p_password !~','coalesce(p_password,'''') !~');
  v:=replace(v,'p_start_date_jalali !~','p_start_date_jalali IS NULL OR p_start_date_jalali !~');
  v:=replace(v,'([0-2][0-9]|3[01])','(0[1-9]|[12][0-9]|3[01])');
  if v not like '%coalesce(p_username,'''') !~%'
     or v not like '%coalesce(p_password,'''') !~%'
     or v not like '%p_start_date_jalali IS NULL OR p_start_date_jalali !~%'
     or v like '%([0-2][0-9]|3[01])%' then
    raise exception 'Admin create account validation patch failed';
  end if;
  execute v;
end
$$;
