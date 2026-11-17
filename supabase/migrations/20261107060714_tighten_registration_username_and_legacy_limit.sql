
do $$
declare d text;
begin
 select pg_get_functiondef(p.oid) into d from pg_proc p
 where p.pronamespace='public'::regnamespace and p.proname='app_submit_registration'
 and pg_get_function_identity_arguments(p.oid)='p_building_name text, p_address text, p_username text, p_password text, p_full_name text, p_phone text, p_email text, p_units_count integer, p_manager_is_resident boolean, p_manager_unit_no integer, p_manager_area numeric, p_manager_persons integer, p_manager_start_date_jalali text';
 d:=replace(d,
 ' if exists(select 1 from public.accounts where lower(username)=lower(p_username))',
 ' perform pg_advisory_xact_lock(hashtextextended(lower(p_username),0)); 
 if exists(select 1 from public.superadmin_accounts where lower(username)=lower(p_username))
  or exists(select 1 from public.accounts where lower(username)=lower(p_username))');
 execute d;

 select pg_get_functiondef(p.oid) into d from pg_proc p
 where p.pronamespace='public'::regnamespace and p.proname='app_submit_member_registration';
 d:=replace(d,
 ' if exists(select 1 from public.accounts where lower(username)=lower(p_username))',
 ' perform pg_advisory_xact_lock(hashtextextended(lower(p_username),0));
 if exists(select 1 from public.superadmin_accounts where lower(username)=lower(p_username))
  or exists(select 1 from public.accounts where lower(username)=lower(p_username))');
 execute d;
end $$;

create or replace function public.app_submit_registration(
 p_building_name text,p_address text,p_username text,p_password text,p_full_name text,
 p_phone text,p_email text,p_units_count integer
) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,extensions
as $$
begin
 return public.app_submit_registration(p_building_name,p_address,p_username,p_password,p_full_name,p_phone,p_email,
   p_units_count,false,null,null,null,null);
end $$;
grant execute on function public.app_submit_registration(text,text,text,text,text,text,text,integer) to anon,authenticated;

