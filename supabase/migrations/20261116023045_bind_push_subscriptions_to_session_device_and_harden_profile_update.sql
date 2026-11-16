-- Bind each push subscription to the device ID of the authenticated session.
-- A self-service password change keeps the current device subscribed but removes
-- subscriptions from other devices whose sessions are being revoked.
alter table public.push_subscriptions
  add column if not exists device_id text;

create index if not exists push_subscriptions_account_device_idx
  on public.push_subscriptions(account_id,device_id);

create or replace function public.app_push_save_subscription(
  p_token uuid,
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text
)
returns jsonb
language plpgsql
security definer
set search_path = public
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
    set p256dh=excluded.p256dh,
        auth=excluded.auth,
        user_agent=excluded.user_agent,
        device_id=excluded.device_id,
        updated_at=now()
    where public.push_subscriptions.account_id=excluded.account_id
      and public.push_subscriptions.building_id=excluded.building_id;

  get diagnostics v_rows = row_count;
  if v_rows=0 then
    raise exception 'این اشتراک اعلان قبلاً به حساب دیگری متصل شده است';
  end if;

  return jsonb_build_object('ok',true);
end
$function$;

create or replace function public.app_update_profile(
  p_token uuid,
  p_full_name text,
  p_phone text,
  p_email text,
  p_username text,
  p_current_password text,
  p_new_password text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $function$
declare
  me public.accounts;
  v_device_id text;
begin
  me:=public.bm_auth(p_token);

  if coalesce(trim(p_full_name),'')='' or length(trim(p_full_name))>150
     or (p_phone is not null and length(p_phone)>32)
     or (p_email is not null and length(p_email)>254)
     or (nullif(trim(p_email),'') is not null and trim(p_email) !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') then
    return jsonb_build_object('ok',false,'error','نام، شماره تماس یا ایمیل معتبر نیست');
  end if;

  if me.password_hash is null
     or me.password_hash<>extensions.crypt(coalesce(p_current_password,''),me.password_hash) then
    return jsonb_build_object('ok',false,'error','رمز فعلی اشتباه است');
  end if;

  if coalesce(p_username,'') !~ '^[A-Za-z][A-Za-z0-9_]{2,31}$' then
    return jsonb_build_object('ok',false,'error','نام کاربری معتبر نیست');
  end if;

  if exists(
    select 1 from public.accounts a
     where a.building_id=me.building_id
       and lower(a.username)=lower(p_username)
       and a.id<>me.id
  ) then
    return jsonb_build_object('ok',false,'error','نام کاربری تکراری است');
  end if;

  if me.must_change_password and coalesce(p_new_password,'')='' then
    return jsonb_build_object('ok',false,'error','برای ادامه باید رمز عبور جدید تعیین کنید');
  end if;

  if coalesce(p_new_password,'')<>'' and p_new_password !~ '^[0-9]{4,8}$' then
    return jsonb_build_object('ok',false,'error','رمز جدید باید ۴ تا ۸ رقم باشد');
  end if;

  if coalesce(p_new_password,'')<>'' then
    select s.device_id into v_device_id
      from public.sessions s
     where s.token=p_token
       and s.account_id=me.id
       and s.building_id=me.building_id
       and s.revoked_at is null
       and s.expires_at>now();
  end if;

  update public.accounts
     set full_name=p_full_name,
         phone=p_phone,
         email=p_email,
         username=p_username,
         password_hash=case
           when coalesce(p_new_password,'')<>'' then extensions.crypt(p_new_password,extensions.gen_salt('bf',12))
           when substring(me.password_hash from 5 for 2)::integer<12 then extensions.crypt(p_current_password,extensions.gen_salt('bf',12))
           else password_hash
         end,
         must_change_password=case
           when coalesce(p_new_password,'')<>'' then false
           else me.must_change_password
         end,
         updated_at=now()
   where id=me.id and building_id=me.building_id;

  if coalesce(p_new_password,'')<>'' then
    update public.sessions
       set revoked_at=now()
     where account_id=me.id
       and building_id=me.building_id
       and token<>p_token
       and revoked_at is null;

    delete from public.push_subscriptions
     where account_id=me.id
       and building_id=me.building_id
       and (v_device_id is null or device_id is distinct from v_device_id);
  end if;

  select * into me
    from public.accounts
   where id=me.id and building_id=me.building_id;

  return public.bm_account_json(me);
end
$function$;
