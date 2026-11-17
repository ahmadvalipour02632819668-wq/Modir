alter table public.sessions add column if not exists device_id text;

create index if not exists sessions_superadmin_device_active_idx
  on public.sessions (superadmin_id, device_id)
  where revoked_at is null;

create index if not exists sessions_account_device_active_idx
  on public.sessions (account_id, device_id)
  where revoked_at is null;

create or replace function public.app_login_unified(
  p_login text,
  p_password text,
  p_replace_session_id uuid default null,
  p_device_label text default null,
  p_device_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
declare
  sa public.superadmin_accounts;
  a public.accounts;
  v_token uuid;
  v_count integer;
  v_sessions jsonb;
  b public.buildings;
  v_device text := left(coalesce(nullif(trim(p_device_label),''),'دستگاه ناشناس'),80);
  v_device_id text := nullif(left(trim(coalesce(p_device_id,'')),100), '');
begin
  if v_device_id is null then
    return jsonb_build_object('ok',false,'code','DEVICE_ID_REQUIRED','error','شناسه این دستگاه دریافت نشد؛ صفحه را تازه‌سازی کنید');
  end if;

  select * into sa from public.superadmin_accounts
   where lower(username)=lower(trim(coalesce(p_login,''))) and is_active limit 1 for update;
  if found and sa.password_hash=extensions.crypt(coalesce(p_password,''),sa.password_hash) then
    update public.sessions set revoked_at=now()
     where superadmin_id=sa.id and device_id=v_device_id
       and revoked_at is null and expires_at>now();

    select count(distinct coalesce(device_id,'legacy')) into v_count
      from public.sessions
     where superadmin_id=sa.id and revoked_at is null and expires_at>now();

    if v_count>=2 and p_replace_session_id is null then
      select coalesce(jsonb_agg(jsonb_build_object('session_id',session_id,'device_label',device_label,'created_at',created_at) order by created_at),'[]'::jsonb)
       into v_sessions from public.sessions
       where superadmin_id=sa.id and revoked_at is null and expires_at>now();
      return jsonb_build_object('ok',false,'code','SESSION_LIMIT','sessions',v_sessions);
    elsif v_count>=2 then
      update public.sessions set revoked_at=now()
       where session_id=p_replace_session_id and superadmin_id=sa.id and revoked_at is null and expires_at>now();
      if not found then return jsonb_build_object('ok',false,'code','SESSION_CHANGED','error','نشست انتخاب‌شده دیگر فعال نیست؛ دوباره تلاش کنید'); end if;
      select count(distinct coalesce(device_id,'legacy')) into v_count
        from public.sessions where superadmin_id=sa.id and revoked_at is null and expires_at>now();
      if v_count>=2 then
        select coalesce(jsonb_agg(jsonb_build_object('session_id',session_id,'device_label',device_label,'created_at',created_at) order by created_at),'[]'::jsonb)
         into v_sessions from public.sessions where superadmin_id=sa.id and revoked_at is null and expires_at>now();
        return jsonb_build_object('ok',false,'code','SESSION_LIMIT','sessions',v_sessions);
      end if;
    elsif p_replace_session_id is not null then
      return jsonb_build_object('ok',false,'code','SESSION_CHANGED','error','وضعیت نشست‌ها تغییر کرده است؛ دوباره تلاش کنید');
    end if;

    insert into public.sessions(building_id,superadmin_id,expires_at,device_label,device_id)
     values(null,sa.id,now()+interval '8 hours',v_device,v_device_id) returning token into v_token;
    return jsonb_build_object('ok',true,'kind','superadmin','token',v_token,
      'account',jsonb_build_object('id',sa.id,'username',sa.username,'full_name',sa.full_name,'role','superadmin'));
  end if;

  select * into a from public.accounts where lower(username)=lower(trim(coalesce(p_login,''))) limit 1 for update;
  if not found or not a.is_active then return jsonb_build_object('ok',false,'error','نام کاربری یا رمز عبور اشتباه است'); end if;
  if a.locked_until is not null and a.locked_until>now() then return jsonb_build_object('ok',false,'error','حساب موقتاً قفل است'); end if;
  if a.password_hash<>extensions.crypt(coalesce(p_password,''),a.password_hash) then
    update public.accounts set failed_attempts=case when failed_attempts+1>=5 then 0 else failed_attempts+1 end,
      locked_until=case when failed_attempts+1>=5 then now()+interval '10 minutes' else null end where id=a.id;
    return jsonb_build_object('ok',false,'error','نام کاربری یا رمز عبور اشتباه است');
  end if;
  update public.accounts set failed_attempts=0,locked_until=null where id=a.id;
  select * into b from public.buildings where id=a.building_id and status='active';
  if not found then return jsonb_build_object('ok',false,'error','ساختمان حساب کاربری فعال نیست'); end if;

  update public.sessions set revoked_at=now()
   where account_id=a.id and device_id=v_device_id
     and revoked_at is null and expires_at>now();

  select count(distinct coalesce(device_id,'legacy')) into v_count
    from public.sessions where account_id=a.id and revoked_at is null and expires_at>now();

  if v_count>=2 and p_replace_session_id is null then
    select coalesce(jsonb_agg(jsonb_build_object('session_id',session_id,'device_label',device_label,'created_at',created_at) order by created_at),'[]'::jsonb)
     into v_sessions from public.sessions where account_id=a.id and revoked_at is null and expires_at>now();
    return jsonb_build_object('ok',false,'code','SESSION_LIMIT','sessions',v_sessions);
  elsif v_count>=2 then
    update public.sessions set revoked_at=now()
     where session_id=p_replace_session_id and account_id=a.id and revoked_at is null and expires_at>now();
    if not found then return jsonb_build_object('ok',false,'code','SESSION_CHANGED','error','نشست انتخاب‌شده دیگر فعال نیست؛ دوباره تلاش کنید'); end if;
    select count(distinct coalesce(device_id,'legacy')) into v_count
      from public.sessions where account_id=a.id and revoked_at is null and expires_at>now();
    if v_count>=2 then
      select coalesce(jsonb_agg(jsonb_build_object('session_id',session_id,'device_label',device_label,'created_at',created_at) order by created_at),'[]'::jsonb)
       into v_sessions from public.sessions where account_id=a.id and revoked_at is null and expires_at>now();
      return jsonb_build_object('ok',false,'code','SESSION_LIMIT','sessions',v_sessions);
    end if;
  elsif p_replace_session_id is not null then
    return jsonb_build_object('ok',false,'code','SESSION_CHANGED','error','وضعیت نشست‌ها تغییر کرده است؛ دوباره تلاش کنید');
  end if;

  insert into public.sessions(account_id,building_id,expires_at,device_label,device_id)
   values(a.id,a.building_id,now()+interval '7 days',v_device,v_device_id) returning token into v_token;
  insert into public.activity_logs(building_id,account_id,unit_no,full_name,action,details,actor_id)
   values(a.building_id,a.id,a.unit_no,a.full_name,'ورود','ورود موفق',a.id);
  return jsonb_build_object('ok',true,'kind','building','token',v_token,
   'account',public.bm_account_json(a)||jsonb_build_object('building_name',b.name,'units_count',(select count(*) from public.units where building_id=a.building_id)));
end
$function$;
