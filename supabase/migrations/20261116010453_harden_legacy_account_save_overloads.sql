do $$
declare v text;
begin
  select pg_get_functiondef('public.app_admin_save_account(uuid,uuid,integer,text,text,text,text,boolean,boolean,text,integer,text)'::regprocedure)
    into v;
  v:=replace(v,
    'IF p_start_date_jalali !~',
    'IF p_start_date_jalali IS NULL OR p_start_date_jalali !~');
  if v not like '%p_start_date_jalali IS NULL OR p_start_date_jalali !~%' then
    raise exception 'Could not apply required null-date validation';
  end if;
  execute v;
end
$$;

create or replace function public.app_admin_save_account(
  p_token uuid,
  p_id uuid,
  p_unit_no integer,
  p_username text,
  p_full_name text,
  p_phone text,
  p_occupancy text,
  p_is_primary boolean,
  p_is_active boolean,
  p_new_password text,
  p_start_ym integer
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions'
as $function$
declare
  v_ym integer := coalesce(p_start_ym,140406);
  v_date text;
begin
  v_date :=
    left(lpad(v_ym::text,6,'0'),4)||'/'||
    right(lpad(v_ym::text,6,'0'),2)||'/01';

  return public.app_admin_save_account(
    p_token,p_id,p_unit_no,p_username,p_full_name,p_phone,p_occupancy,
    p_is_primary,p_is_active,p_new_password,v_ym,v_date
  );
end
$function$;
