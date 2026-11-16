create or replace function public.app_admin_reply_request(
  p_token text,
  p_id bigint,
  p_status text,
  p_reply text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  me public.accounts;
  v_reply text := btrim(coalesce(p_reply,''));
begin
  me := public.bm_admin(p_token::uuid);

  if p_status is null or p_status not in ('reviewing','done') then
    raise exception 'وضعیت پاسخ معتبر نیست';
  end if;
  if length(v_reply) < 1 or length(v_reply) > 2000 then
    raise exception 'متن پاسخ باید بین ۱ تا ۲۰۰۰ نویسه باشد';
  end if;

  update public.resident_requests
     set status=p_status,
         admin_reply=v_reply,
         replied_at=now(),
         replied_by=me.full_name
   where id=p_id and building_id=me.building_id;

  if not found then
    raise exception 'درخواست یافت نشد';
  end if;

  return jsonb_build_object('ok',true);
end
$function$;
