
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.app_accounts(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;
revoke all on public.push_subscriptions from public;

create or replace function public.app_push_save_subscription(p_token uuid,p_subscription jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_acc public.app_accounts; v_endpoint text; v_p256dh text; v_auth text;
begin
  v_acc := public.app_require_session(p_token);
  v_endpoint := nullif(btrim(p_subscription->>'endpoint'),'');
  v_p256dh := nullif(btrim(p_subscription->'keys'->>'p256dh'),'');
  v_auth := nullif(btrim(p_subscription->'keys'->>'auth'),'');
  if v_endpoint is null or v_p256dh is null or v_auth is null
     or v_endpoint !~ '^https://'
     or length(v_endpoint)>2048 or length(v_p256dh)>256 or length(v_auth)>256 then
    raise exception 'اطلاعات اشتراک اعلان معتبر نیست';
  end if;
  insert into public.push_subscriptions(account_id,endpoint,p256dh,auth,user_agent,updated_at)
  values(v_acc.id,v_endpoint,v_p256dh,v_auth,left(p_subscription->>'userAgent',500),now())
  on conflict(endpoint) do update set account_id=excluded.account_id,p256dh=excluded.p256dh,
    auth=excluded.auth,user_agent=excluded.user_agent,updated_at=now();
  return jsonb_build_object('success',true);
end $$;

create or replace function public.app_push_delete_subscription(p_token uuid,p_endpoint text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_acc public.app_accounts;
begin
  v_acc := public.app_require_session(p_token);
  delete from public.push_subscriptions where account_id=v_acc.id and endpoint=p_endpoint;
  return jsonb_build_object('success',true);
end $$;
revoke all on function public.app_push_save_subscription(uuid,jsonb) from public;
revoke all on function public.app_push_delete_subscription(uuid,text) from public;
grant execute on function public.app_push_save_subscription(uuid,jsonb) to anon, authenticated;
grant execute on function public.app_push_delete_subscription(uuid,text) to anon, authenticated;

