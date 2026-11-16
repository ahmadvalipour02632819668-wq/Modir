do $$
declare
  v text;
begin
  select pg_get_functiondef('public.app_submit_member_registration(integer,integer,text,text,text,text,text,text,numeric,integer,text)'::regprocedure)
    into v;
  v:=replace(v,'p_start_date_jalali !~','p_start_date_jalali IS NULL OR p_start_date_jalali !~');
  v:=replace(v,'([0-2][0-9]|3[01])','(0[1-9]|[12][0-9]|3[01])');
  if v not like '%p_start_date_jalali IS NULL OR p_start_date_jalali !~%'
     or v like '%([0-2][0-9]|3[01])%' then
    raise exception 'Member registration date validation patch failed';
  end if;
  execute v;

  select pg_get_functiondef('public.app_submit_registration(text,text,text,text,text,text,text,integer,boolean,integer,numeric,integer,text)'::regprocedure)
    into v;
  v:=replace(v,'p_manager_start_date_jalali !~','p_manager_start_date_jalali IS NULL OR p_manager_start_date_jalali !~');
  v:=replace(v,'([0-2][0-9]|3[01])','(0[1-9]|[12][0-9]|3[01])');
  if v not like '%p_manager_start_date_jalali IS NULL OR p_manager_start_date_jalali !~%'
     or v like '%([0-2][0-9]|3[01])%' then
    raise exception 'Building registration date validation patch failed';
  end if;
  execute v;

  select pg_get_functiondef('public.app_admin_save_account(uuid,uuid,integer,text,text,text,text,boolean,boolean,text,integer,text)'::regprocedure)
    into v;
  v:=replace(v,'([0-2][0-9]|3[01])','(0[1-9]|[12][0-9]|3[01])');
  if v like '%([0-2][0-9]|3[01])%' then
    raise exception 'Admin account date validation patch failed';
  end if;
  execute v;
end
$$;
