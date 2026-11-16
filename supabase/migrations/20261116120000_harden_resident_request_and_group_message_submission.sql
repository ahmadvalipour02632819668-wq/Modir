create or replace function public.app_submit_request(
  p_token uuid,
  p_type text,
  p_description text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  me public.accounts;
  rid bigint;
  v_description text;
  v_recent integer;
begin
  me := public.bm_auth(p_token);
  v_description := btrim(coalesce(p_description, ''));

  if p_type is null or p_type not in ('درخواست تعمیرات', 'انتقاد و پیشنهاد') then
    raise exception 'نوع درخواست معتبر نیست';
  end if;
  if length(v_description) < 3 or length(v_description) > 2000 then
    raise exception 'توضیحات درخواست باید بین ۳ تا ۲۰۰۰ نویسه باشد';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('resident-request:' || me.id::text, 0));
  select count(*) into v_recent
  from public.resident_requests
  where account_id = me.id and created_at >= now() - interval '1 hour';
  if v_recent >= 5 then
    raise exception 'تعداد درخواست‌ها در یک ساعت بیش از حد مجاز است';
  end if;

  insert into public.resident_requests(building_id,account_id,unit_no,type,description,status)
  values(me.building_id,me.id,me.unit_no,p_type,v_description,'pending')
  returning id into rid;

  return jsonb_build_object('ok',true,'id',rid);
end
$function$;

create or replace function public.app_submit_group_message(
  p_token uuid,
  p_message text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  me public.accounts;
  rid bigint;
  v_message text;
  v_recent integer;
begin
  me := public.bm_auth(p_token);
  v_message := btrim(coalesce(p_message, ''));

  if length(v_message) < 1 or length(v_message) > 3000 then
    raise exception 'متن پیام باید حداکثر ۳۰۰۰ نویسه باشد';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('group-message:' || me.id::text, 0));
  select count(*) into v_recent
  from public.group_messages
  where account_id = me.id and created_at >= now() - interval '10 minutes';
  if v_recent >= 5 then
    raise exception 'تعداد پیام‌ها در ۱۰ دقیقه بیش از حد مجاز است';
  end if;

  insert into public.group_messages(building_id,account_id,message)
  values(me.building_id,me.id,v_message)
  returning id into rid;

  return jsonb_build_object('ok',true,'id',rid);
end
$function$;

revoke all on function public.app_submit_request(uuid,text,text) from public;
revoke all on function public.app_submit_request(uuid,text,text) from authenticated;
grant execute on function public.app_submit_request(uuid,text,text) to anon;

revoke all on function public.app_submit_group_message(uuid,text) from public;
revoke all on function public.app_submit_group_message(uuid,text) from authenticated;
grant execute on function public.app_submit_group_message(uuid,text) to anon;
