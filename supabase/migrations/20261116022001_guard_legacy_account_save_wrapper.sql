-- Make the legacy account-save overload explicitly authenticate before delegating.
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
set search_path = public, extensions
as $function$
declare
  v_ym integer := coalesce(p_start_ym,140406);
  v_date text;
begin
  perform public.bm_admin(p_token);

  v_date := left(lpad(v_ym::text,6,'0'),4)
            || '/' || right(lpad(v_ym::text,6,'0'),2) || '/01';

  return public.app_admin_save_account(
    p_token,p_id,p_unit_no,p_username,p_full_name,p_phone,p_occupancy,
    p_is_primary,p_is_active,p_new_password,v_ym,v_date
  );
end
$function$;
