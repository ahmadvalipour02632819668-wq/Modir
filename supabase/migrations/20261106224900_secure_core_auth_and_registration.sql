
create extension if not exists pgcrypto with schema extensions;
create unique index if not exists accounts_username_global_uq on public.accounts(lower(username));
alter table public.sessions add column if not exists superadmin_id uuid references public.superadmin_accounts(id);
alter table public.sessions alter column account_id drop not null;
alter table public.sessions add constraint sessions_exactly_one_identity check ((account_id is not null)::int + (superadmin_id is not null)::int = 1);
create or replace function public.bm_account_json(a public.accounts) returns jsonb
language sql stable security definer set search_path=public as $$
 select jsonb_build_object('id',a.id,'username',a.username,'unit_no',a.unit_no,'full_name',a.full_name,
 'phone',a.phone,'email',a.email,'occupancy',a.occupancy,'is_admin',a.is_admin,'is_primary',a.is_primary,
 'is_active',a.is_active,'must_change_password',a.must_change_password,'start_ym',a.start_ym,
 'building_id',a.building_id,'role',a.role);
$$;
create or replace function public.bm_auth(p_token uuid) returns public.accounts
language plpgsql stable security definer set search_path=public as $$
declare a public.accounts;
begin
 select ac.* into a from public.sessions s join public.accounts ac on ac.id=s.account_id
 join public.buildings b on b.id=s.building_id
 where s.token=p_token and s.revoked_at is null and s.expires_at>now()
 and ac.is_active and b.status='active';
 if not found then raise exception 'AUTH_REQUIRED'; end if;
 return a;
end $$;
create or replace function public.app_public_info() returns jsonb
language sql stable security definer set search_path=public as $$
 select jsonb_build_object('building_name',coalesce((select value from public.settings where key='building_name' and building_id=1),'سامانه مدیریت مجتمع‌ها'));
$$;
create or replace function public.app_login(p_login text,p_password text) returns jsonb
language plpgsql security definer set search_path=public,extensions as $$
declare a public.accounts; v_token uuid;
begin
 select * into a from public.accounts where lower(username)=lower(btrim(p_login)) limit 1;
 if not found or not a.is_active or a.password_hash<>extensions.crypt(coalesce(p_password,''),a.password_hash) then
  return jsonb_build_object('ok',false,'error','نام کاربری یا رمز عبور اشتباه است');
 end if;
 if a.locked_until is not null and a.locked_until>now() then return jsonb_build_object('ok',false,'error','حساب موقتاً قفل است'); end if;
 update public.accounts set failed_attempts=0,locked_until=null where id=a.id;
 insert into public.sessions(account_id,building_id,expires_at) values(a.id,a.building_id,now()+interval '7 days') returning token into v_token;
 return jsonb_build_object('ok',true,'token',v_token,'account',public.bm_account_json(a));
end $$;
create or replace function public.app_me(p_token uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare a public.accounts;
begin a:=public.bm_auth(p_token); return public.bm_account_json(a); end $$;
create or replace function public.app_logout(p_token uuid) returns void
language sql security definer set search_path=public as $$
 update public.sessions set revoked_at=now() where token=p_token and revoked_at is null;
$$;
create or replace function public.app_submit_registration(
 p_building_name text,p_address text,p_username text,p_password text,p_full_name text,
 p_phone text,p_email text,p_units_count integer
) returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare v_id bigint;
begin
 if p_username !~ '^[A-Za-z][A-Za-z0-9_]{2,31}$' then return jsonb_build_object('ok',false,'error','نام کاربری باید انگلیسی و ۳ تا ۳۲ نویسه باشد'); end if;
 if p_password !~ '^[0-9]{4,8}$' then return jsonb_build_object('ok',false,'error','رمز عبور باید ۴ تا ۸ رقم باشد'); end if;
 if p_units_count<1 or p_units_count>99 then return jsonb_build_object('ok',false,'error','تعداد واحد معتبر نیست'); end if;
 if exists(select 1 from public.accounts where lower(username)=lower(p_username)) or exists(select 1 from public.registration_requests where lower(username)=lower(p_username) and status='pending') then
  return jsonb_build_object('ok',false,'error','این نام کاربری قبلاً ثبت شده است');
 end if;
 insert into public.registration_requests(building_name,address,username,password_hash,full_name,phone,email,units_count)
 values(trim(p_building_name),trim(p_address),trim(p_username),extensions.crypt(p_password,extensions.gen_salt('bf')),trim(p_full_name),nullif(trim(p_phone),''),nullif(trim(p_email),''),p_units_count)
 returning id into v_id;
 return jsonb_build_object('ok',true,'request_id',v_id,'message','درخواست ثبت شد و پس از تأیید فعال می‌شود');
end $$;
do $$
declare t text;
begin
 foreach t in array array['buildings','accounts','units','transactions','rates','settings','exemptions','announcements','payment_requests','resident_requests','activity_logs','sessions','profile_avatars','push_subscriptions','building_polls','building_poll_options','building_poll_votes','management_transfer_requests','receipts','receipt_lines','ledger','registration_requests','superadmin_accounts']
 loop execute format('alter table public.%I enable row level security',t); execute format('revoke all on public.%I from anon, authenticated',t); end loop;
end $$;
revoke all on function public.bm_account_json(public.accounts) from public;
revoke all on function public.bm_auth(uuid) from public;
revoke all on function public.app_public_info() from public;
revoke all on function public.app_login(text,text) from public;
revoke all on function public.app_me(uuid) from public;
revoke all on function public.app_logout(uuid) from public;
revoke all on function public.app_submit_registration(text,text,text,text,text,text,text,integer) from public;
grant execute on function public.app_public_info(),public.app_login(text,text),public.app_me(uuid),public.app_logout(uuid),public.app_submit_registration(text,text,text,text,text,text,text,integer) to anon,authenticated;

