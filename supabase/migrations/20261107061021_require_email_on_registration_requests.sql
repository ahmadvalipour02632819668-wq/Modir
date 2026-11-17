
do $$
declare d text;
begin
 select pg_get_functiondef(oid) into d from pg_proc
 where pronamespace='public'::regnamespace and proname='app_submit_registration'
 and pg_get_function_identity_arguments(oid) like '%p_manager_is_resident boolean%';
 d:=replace(d,
  $old$coalesce(trim(p_phone),'')='' then$old$,
  $new$coalesce(trim(p_phone),'')='' or coalesce(trim(p_email),'')='' or trim(p_email) !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then$new$);
 execute d;
 select pg_get_functiondef(oid) into d from pg_proc
 where pronamespace='public'::regnamespace and proname='app_submit_member_registration';
 d:=replace(d,
  $old$coalesce(trim(p_phone),'')='' or coalesce(p_area,0)<=0$old$,
  $new$coalesce(trim(p_phone),'')='' or coalesce(trim(p_email),'')='' or trim(p_email) !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or coalesce(p_area,0)<=0$new$);
 execute d;
end $$;

