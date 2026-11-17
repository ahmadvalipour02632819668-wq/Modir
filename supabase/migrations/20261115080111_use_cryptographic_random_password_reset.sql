create or replace function public.app_admin_reset_password(p_token uuid,p_id uuid)
returns text
language plpgsql
security definer
set search_path to 'public','extensions'
as $function$
declare
  me public.accounts;
  v_temp text;
  v_bytes bytea;
  v_num bigint;
begin
  me:=public.bm_admin(p_token);

  if not exists(
    select 1 from public.accounts
    where id=p_id and building_id=me.building_id
  ) then
    raise exception 'حساب پیدا نشد';
  end if;

  v_bytes:=extensions.gen_random_bytes(4);
  v_num:=get_byte(v_bytes,0)::bigint*16777216
       + get_byte(v_bytes,1)::bigint*65536
       + get_byte(v_bytes,2)::bigint*256
       + get_byte(v_bytes,3)::bigint;
  v_temp:=lpad((v_num % 100000000)::text,8,'0');

  update public.accounts
     set password_hash=extensions.crypt(v_temp,extensions.gen_salt('bf')),
         must_change_password=true,
         failed_attempts=0,
         locked_until=null,
         updated_at=now()
   where id=p_id and building_id=me.building_id;

  update public.sessions
     set revoked_at=now()
   where account_id=p_id
     and building_id=me.building_id
     and revoked_at is null;

  return v_temp;
end
$function$;
