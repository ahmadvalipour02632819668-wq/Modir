do $$
declare v text;
begin
  select pg_get_functiondef('public.app_submit_member_registration(integer,integer,text,text,text,text,text,text,numeric,integer,text)'::regprocedure) into v;
  v:=replace(v,'if p_occupancy not in','if p_occupancy is null or p_occupancy not in');
  v:=replace(v,'p_username !~','coalesce(p_username,'''') !~');
  v:=replace(v,'p_password !~','coalesce(p_password,'''') !~');
  execute v;

  select pg_get_functiondef('public.app_submit_registration(text,text,text,text,text,text,text,integer,boolean,integer,numeric,integer,text)'::regprocedure) into v;
  v:=replace(v,'p_username !~','coalesce(p_username,'''') !~');
  v:=replace(v,'p_password !~','coalesce(p_password,'''') !~');
  v:=replace(v,'if p_units_count not between','if p_units_count is null or p_units_count not between');
  v:=replace(v,'if p_manager_is_resident and (','if coalesce(p_manager_is_resident,false) and (');
  v:=replace(v,'p_manager_unit_no not between','p_manager_unit_no is null or p_manager_unit_no not between');
  execute v;

  select pg_get_functiondef('public.app_admin_save_account(uuid,uuid,integer,text,text,text,text,boolean,boolean,text,integer,text)'::regprocedure) into v;
  v:=replace(v,'p_username !~','coalesce(p_username,'''') !~');
  execute v;
end
$$;
