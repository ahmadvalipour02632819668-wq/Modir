-- Allow a web-push endpoint to move between accounts only when the authenticated
-- session proves it belongs to the same registered device. Endpoints on other
-- devices remain protected from takeover.
create or replace function public.app_push_save_subscription(
  p_token uuid, p_endpoint text, p_p256dh text, p_auth text, p_user_agent text
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  me public.accounts;
  v_rows integer;
  v_device_id text;
begin
  me := public.bm_auth(p_token);

  select s.device_id into v_device_id
    from public.sessions s
   where s.token=p_token
     and s.account_id=me.id
     and s.building_id=me.building_id
     and s.revoked_at is null
     and s.expires_at>now();

  if v_device_id is null or length(v_device_id)<8 or length(v_device_id)>128 then
    raise exception 'شناسه دستگاه معتبر نیست؛ یک‌بار خارج شوید و دوباره وارد شوید';
  end if;

  if p_endpoint is null or length(p_endpoint)>2048
     or p_endpoint !~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)/' then
    raise exception 'نشانی سرویس اعلان معتبر نیست';
  end if;

  if p_p256dh is null or p_p256dh !~ '^[A-Za-z0-9_-]{80,120}$'
     or p_auth is null or p_auth !~ '^[A-Za-z0-9_-]{16,64}$' then
    raise exception 'کلیدهای اشتراک اعلان معتبر نیستند';
  end if;

  if p_user_agent is not null and length(p_user_agent)>512 then
    raise exception 'اطلاعات مرورگر بیش از حد مجاز است';
  end if;

  insert into public.push_subscriptions(
    account_id,building_id,endpoint,p256dh,auth,user_agent,device_id,updated_at
  )
  values(
    me.id,me.building_id,p_endpoint,p_p256dh,p_auth,p_user_agent,v_device_id,now()
  )
  on conflict(endpoint) do update
    set account_id=excluded.account_id,
        building_id=excluded.building_id,
        p256dh=excluded.p256dh,
        auth=excluded.auth,
        user_agent=excluded.user_agent,
        device_id=excluded.device_id,
        updated_at=now()
    where public.push_subscriptions.device_id=excluded.device_id;

  get diagnostics v_rows = row_count;
  if v_rows=0 then
    raise exception 'این اشتراک اعلان روی دستگاه دیگری ثبت شده است';
  end if;

  return jsonb_build_object('ok',true);
end
$function$;
